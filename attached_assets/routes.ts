import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { taxInputWithUserSchema, taxResultSchema, userRegistrationSchema, expenseInputWithUserSchema, expenseResultSchema } from "@shared/schema";
import { aiService } from "./ai-service";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

// 2024 Canadian Tax Calculation Constants (Ontario-focused)
const TAX_RATES = {
  // Corporate rates
  SMALL_BUSINESS_RATE: 0.122, // 12.2% (9% federal + 3.2% Ontario)
  
  // Personal tax brackets (combined federal + Ontario)
  PERSONAL_BRACKETS: [
    { min: 0, max: 51446, rate: 0.2005 },      // 20.05%
    { min: 51447, max: 55867, rate: 0.2415 },  // 24.15%
    { min: 55868, max: 102894, rate: 0.2965 }, // 29.65%
    { min: 102895, max: 111733, rate: 0.3166 }, // 31.66%
    { min: 111734, max: 150000, rate: 0.3716 }, // 37.16%
    { min: 150001, max: 173205, rate: 0.3816 }, // 38.16%
    { min: 173206, max: 220000, rate: 0.4116 }, // 41.16%
    { min: 220001, max: 246752, rate: 0.4216 }, // 42.16%
    { min: 246753, max: Infinity, rate: 0.4953 } // 49.53%
  ],
  
  // CPP rates for 2024
  CPP: {
    YMPE: 68500,          // Year's Maximum Pensionable Earnings
    BASIC_EXEMPTION: 3500,
    EMPLOYEE_RATE: 0.0595, // 5.95%
    YAMPE: 73200,         // Year's Additional Maximum Pensionable Earnings
    CPP2_RATE: 0.04       // 4% on earnings between YMPE and YAMPE
  },
  
  // EI rates for 2024
  EI: {
    MIE: 63200,           // Maximum Insurable Earnings
    EMPLOYEE_RATE: 0.0166, // 1.66%
    EMPLOYER_RATE: 0.02324 // 2.324% (1.4 x employee rate)
  },
  
  // Dividend tax credits (non-eligible dividends)
  DIVIDEND: {
    GROSS_UP: 0.15,       // 15%
    FEDERAL_DTC: 0.090301, // 9.0301%
    ONTARIO_DTC: 0.029863  // 2.9863%
  }
};

function calculatePersonalTax(taxableIncome: number): number {
  let tax = 0;
  let remainingIncome = taxableIncome;
  
  for (const bracket of TAX_RATES.PERSONAL_BRACKETS) {
    if (remainingIncome <= 0) break;
    
    const bracketWidth = bracket.max - bracket.min + 1;
    const taxableInThisBracket = Math.min(remainingIncome, bracketWidth);
    tax += taxableInThisBracket * bracket.rate;
    remainingIncome -= taxableInThisBracket;
  }
  
  return tax;
}

function calculateCPPContributions(salary: number): { employee: number; employer: number } {
  const contributoryEarnings = Math.min(Math.max(salary - TAX_RATES.CPP.BASIC_EXEMPTION, 0), TAX_RATES.CPP.YMPE - TAX_RATES.CPP.BASIC_EXEMPTION);
  const cpp1 = contributoryEarnings * TAX_RATES.CPP.EMPLOYEE_RATE;
  
  // CPP2 on earnings between YMPE and YAMPE
  const cpp2Earnings = Math.min(Math.max(salary - TAX_RATES.CPP.YMPE, 0), TAX_RATES.CPP.YAMPE - TAX_RATES.CPP.YMPE);
  const cpp2 = cpp2Earnings * TAX_RATES.CPP.CPP2_RATE;
  
  const totalEmployee = cpp1 + cpp2;
  return { employee: totalEmployee, employer: totalEmployee };
}

function calculateEIContributions(salary: number): { employee: number; employer: number } {
  const insurable = Math.min(salary, TAX_RATES.EI.MIE);
  const employee = insurable * TAX_RATES.EI.EMPLOYEE_RATE;
  const employer = insurable * TAX_RATES.EI.EMPLOYER_RATE;
  return { employee, employer };
}

function calculateDividendTax(dividend: number, otherIncome: number = 0): { tax: number; grossedUp: number } {
  const grossUp = dividend * TAX_RATES.DIVIDEND.GROSS_UP;
  const grossedUpDividend = dividend + grossUp;
  const totalTaxableIncome = otherIncome + grossedUpDividend;
  
  const grossTax = calculatePersonalTax(totalTaxableIncome) - calculatePersonalTax(otherIncome);
  const federalDTC = grossedUpDividend * TAX_RATES.DIVIDEND.FEDERAL_DTC;
  const ontarioDTC = grossedUpDividend * TAX_RATES.DIVIDEND.ONTARIO_DTC;
  const totalDTC = federalDTC + ontarioDTC;
  
  return { tax: Math.max(grossTax - totalDTC, 0), grossedUp: grossedUpDividend };
}

function calculateSmartSplitStrategy(salary: number, dividend: number, netBusinessIncome: number): any {
  // Personal side calculations
  const cpp = calculateCPPContributions(salary);
  const ei = calculateEIContributions(salary);
  const personalIncomeTax = calculatePersonalTax(salary);
  const dividendResult = calculateDividendTax(dividend, salary);
  
  // Corporate side calculations
  const totalSalaryExpense = salary + cpp.employer + ei.employer;
  const corporateIncomeAfterSalary = Math.max(netBusinessIncome - totalSalaryExpense, 0);
  const corporateTax = corporateIncomeAfterSalary * TAX_RATES.SMALL_BUSINESS_RATE;
  const retainedEarnings = corporateIncomeAfterSalary - corporateTax;
  
  // RRSP room generation (18% of earned income, max $31,560 for 2024)
  const rrspRoom = Math.min(salary * 0.18, 31560);
  
  // Total calculations
  const totalPersonalTax = personalIncomeTax + dividendResult.tax;
  const totalPayrollTaxes = cpp.employee + ei.employee + cpp.employer + ei.employer;
  const totalTax = totalPersonalTax + totalPayrollTaxes + corporateTax;
  const netCash = salary + dividend - (personalIncomeTax + dividendResult.tax + cpp.employee + ei.employee);
  
  // Calculate effective tax rate on personal withdrawal (Gemini's methodology)
  const personalTaxBurden = personalIncomeTax + dividendResult.tax + cpp.employee + ei.employee;
  const personalWithdrawal = salary + dividend;
  const effectivePersonalRate = personalWithdrawal > 0 ? (personalTaxBurden / personalWithdrawal) * 100 : 0;
  
  return {
    salary: `$${salary.toLocaleString()}`,
    dividends: `$${dividend.toLocaleString()}`,
    corporateTax: `$${Math.round(corporateTax).toLocaleString()}`,
    personalTax: `$${Math.round(totalPersonalTax + cpp.employee + ei.employee).toLocaleString()} (Tax: $${Math.round(totalPersonalTax).toLocaleString()}, CPP: $${Math.round(cpp.employee).toLocaleString()}, EI: $${Math.round(ei.employee).toLocaleString()})`,
    totalTax: `$${Math.round(totalTax).toLocaleString()}`,
    netIncome: `$${Math.round(netCash).toLocaleString()}`,
    effectiveTaxRate: `${effectivePersonalRate.toFixed(1)}%`,
    rrspRoom: `$${Math.round(rrspRoom).toLocaleString()}`,
    cppContributions: `$${Math.round(cpp.employee + cpp.employer).toLocaleString()}`,
    corporateRetained: `$${Math.round(Math.max(retainedEarnings - dividend, 0)).toLocaleString()}`
  };
}
// OpenAI instance moved to ai-service.ts for dual API integration

export async function registerRoutes(app: Express): Promise<Server> {
  // User registration route
  app.post("/api/register-user", async (req, res) => {
    try {
      const validatedInput = userRegistrationSchema.parse(req.body);
      const ipAddress = req.ip || req.connection.remoteAddress || null;
      const userAgent = req.get('User-Agent') || null;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedInput.email);
      if (existingUser) {
        return res.json({ user: existingUser });
      }

      // Create new user
      const newUser = await storage.createUser({
        name: validatedInput.name,
        email: validatedInput.email,
        ipAddress,
        userAgent,
      });

      res.json({ user: newUser });
    } catch (error) {
      console.error("User registration error:", error);
      res.status(400).json({ error: "Failed to register user" });
    }
  });

  // Tax calculation route - SmartSplit Calculator
  app.post("/api/tax-calculation", async (req, res) => {
    try {
      // Validate input including user data
      const validatedInput = taxInputWithUserSchema.parse(req.body);
      const { revenue, expensesPercentage, withdrawalAmount, name, email } = validatedInput;

      console.log("SmartSplit calculation request:", { revenue, expensesPercentage, withdrawalAmount, name, email });

      // Calculate net business income
      const expenses = (revenue * expensesPercentage) / 100;
      const netBusinessIncome = revenue - expenses;

      // Calculate the 4 strategies with precise tax calculations based on Gemini's methodology
      const strategies = [
        {
          strategy: "100% Salary",
          ...calculateSmartSplitStrategy(withdrawalAmount, 0, netBusinessIncome)
        },
        {
          strategy: "100% Dividend",
          ...calculateSmartSplitStrategy(0, withdrawalAmount, netBusinessIncome)
        },
        {
          strategy: "50% Salary / 50% Dividend",
          ...calculateSmartSplitStrategy(Math.round(withdrawalAmount * 0.5), Math.round(withdrawalAmount * 0.5), netBusinessIncome)
        },
        {
          strategy: "Optimal Mix (65% Salary / 35% Dividend)",
          ...calculateSmartSplitStrategy(Math.round(withdrawalAmount * 0.65), Math.round(withdrawalAmount * 0.35), netBusinessIncome)
        }
      ];

      console.log("Calculated strategies:", strategies.map(s => `${s.strategy}: Total Tax ${s.totalTax}, Net Income ${s.netIncome}`));

      // Validate the result structure
      const validatedResult = taxResultSchema.parse(strategies);

      // Get user data and additional tracking info
      const ipAddress = req.ip || req.connection.remoteAddress || null;
      const userAgent = req.get('User-Agent') || null;
      const sessionId = (req as any).sessionID || req.get('X-Session-ID') || null;

      // Get user and calculate their calculation number
      const existingUser = await storage.getUserByEmail(email);
      const userCalculations = await storage.getCalculationsByUser(email);
      const calculationNumber = userCalculations.length + 1;

      // Store calculation in database
      await storage.createTaxCalculation({
        userId: existingUser?.id || null,
        name,
        email,
        revenue,
        expensesPercentage,
        withdrawalAmount,
        strategies: validatedResult,
        ipAddress,
        userAgent,
        sessionId,
        calculationNumber,
      });

      res.json({ result: validatedResult });
    } catch (error) {
      console.error("Tax calculation error:", error);
      
      if (error instanceof Error) {
        if (error.message.includes("parse") || error.message.includes("JSON")) {
          res.status(500).json({ 
            error: "Failed to process tax calculation. The AI service returned invalid data. Please try again." 
          });
        } else {
          res.status(400).json({ 
            error: error.message 
          });
        }
      } else {
        res.status(500).json({ 
          error: "An unexpected error occurred during tax calculation." 
        });
      }
    }
  });

  // Expense calculation route
  app.post("/api/calculate-expenses", async (req, res) => {
    try {
      // Validate input including user data
      const validatedInput = expenseInputWithUserSchema.parse(req.body);
      const { 
        revenue, 
        currentExpenses, 
        homeOfficeSize, 
        totalHomeSize, 
        vehicleBusinessUse, 
        vehicleExpenses, 
        monthlyMeals, 
        professionalDevelopment, 
        equipmentPurchases,
        name, 
        email 
      } = validatedInput;

      // Calculate derived values for AI context
      const homeOfficePercentage = totalHomeSize > 0 ? (homeOfficeSize / totalHomeSize) * 100 : 0;
      const annualMeals = monthlyMeals * 12;

      // Create prompt for OpenAI
      const prompt = `You are a Canadian tax expert specializing in business expense optimization. 
      
Business Details:
- Annual Revenue: $${revenue.toLocaleString()}
- Current Expenses: $${currentExpenses.toLocaleString()}
- Home Office: ${homeOfficeSize} sq ft out of ${totalHomeSize} sq ft (${homeOfficePercentage.toFixed(1)}%)
- Vehicle Business Use: ${vehicleBusinessUse}%
- Annual Vehicle Expenses: $${vehicleExpenses.toLocaleString()}
- Annual Meals & Entertainment: $${annualMeals.toLocaleString()}
- Professional Development: $${professionalDevelopment.toLocaleString()}
- Equipment Purchases: $${equipmentPurchases.toLocaleString()}

Generate 4 expense optimization strategies following Canadian tax law (CRA guidelines):

1. Conservative Approach - Lower risk, CRA-safe percentages
2. Aggressive Optimization - Maximum allowable deductions
3. Balanced Strategy - Moderate risk/reward balance  
4. AI Recommended - Your optimal analysis

For each strategy, calculate:
- Home office deduction (based on percentage of home used)
- Vehicle deduction (business use percentage applied)
- Meals deduction (50% of business meals as per CRA rules)
- Professional development deduction
- Equipment deduction (immediate expensing vs CCA)
- Total deductions
- Estimated annual tax savings (assume ~26.5% marginal tax rate)
- Risk level (Low/Medium/High)
- Audit probability assessment

Return as JSON object with strategies array:
{
  "strategies": [
    {
      "strategy": "Conservative Approach",
      "homeOfficeDeduction": "$X,XXX",
      "vehicleDeduction": "$X,XXX", 
      "mealsDeduction": "$X,XXX",
      "professionalDevDeduction": "$X,XXX",
      "equipmentDeduction": "$X,XXX",
      "totalDeductions": "$XX,XXX",
      "taxSavings": "$X,XXX",
      "riskLevel": "Low",
      "auditProbability": "X%"
    },
    {
      "strategy": "Aggressive Optimization",
      "homeOfficeDeduction": "$X,XXX",
      "vehicleDeduction": "$X,XXX", 
      "mealsDeduction": "$X,XXX",
      "professionalDevDeduction": "$X,XXX",
      "equipmentDeduction": "$X,XXX",
      "totalDeductions": "$XX,XXX",
      "taxSavings": "$X,XXX",
      "riskLevel": "High",
      "auditProbability": "X%"
    },
    {
      "strategy": "Balanced Strategy",
      "homeOfficeDeduction": "$X,XXX",
      "vehicleDeduction": "$X,XXX", 
      "mealsDeduction": "$X,XXX",
      "professionalDevDeduction": "$X,XXX",
      "equipmentDeduction": "$X,XXX",
      "totalDeductions": "$XX,XXX",
      "taxSavings": "$X,XXX",
      "riskLevel": "Medium",
      "auditProbability": "X%"
    },
    {
      "strategy": "AI Recommended",
      "homeOfficeDeduction": "$X,XXX",
      "vehicleDeduction": "$X,XXX", 
      "mealsDeduction": "$X,XXX",
      "professionalDevDeduction": "$X,XXX",
      "equipmentDeduction": "$X,XXX",
      "totalDeductions": "$XX,XXX",
      "taxSavings": "$X,XXX",
      "riskLevel": "Medium",
      "auditProbability": "X%"
    }
  ]
}

Focus on realistic, compliant Canadian tax strategies with accurate CRA line references.`;

      // Call dual AI service (Gemini primary for expense analysis)
      const aiResponse = await aiService.generateResponse(
        `You are an expert Canadian tax advisor specializing in business expense optimization. Provide accurate, CRA-compliant advice. ${prompt}`,
        'expense_analysis'
      );

      if (!aiResponse.success) {
        throw new Error(aiResponse.error || 'AI service failed');
      }

      const rawResponse = aiResponse.content || "{}";
      console.log(`${aiResponse.provider.toUpperCase()} Raw Response:`, rawResponse);

      // Parse and validate response
      let parsedResult;
      try {
        parsedResult = JSON.parse(rawResponse);
        // If the response is wrapped in an object, extract the strategies array
        if (parsedResult.strategies) {
          parsedResult = parsedResult.strategies;
        } else if (!Array.isArray(parsedResult)) {
          // If it's a single object, wrap it in an array
          parsedResult = [parsedResult];
        }
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        // Fallback parsing strategies
        const arrayMatch = rawResponse.match(/\[\s*{[\s\S]*?}\s*\]/);
        if (arrayMatch) {
          parsedResult = JSON.parse(arrayMatch[0]);
        } else {
          const objectMatch = rawResponse.match(/{[\s\S]*}/);
          if (objectMatch) {
            const jsonObj = JSON.parse(objectMatch[0]);
            parsedResult = jsonObj.strategies || [jsonObj];
          } else {
            throw new Error("No valid JSON found in response");
          }
        }
      }

      // Validate the result structure
      const validatedResult = expenseResultSchema.parse(parsedResult);

      res.json({ strategies: validatedResult });
    } catch (error) {
      console.error("Expense calculation error:", error);
      
      if (error instanceof Error) {
        if (error.message.includes("parse") || error.message.includes("JSON")) {
          res.status(500).json({ 
            error: "Failed to process expense calculation. The AI service returned invalid data. Please try again." 
          });
        } else {
          res.status(400).json({ 
            error: error.message 
          });
        }
      } else {
        res.status(500).json({ 
          error: "An unexpected error occurred during expense calculation." 
        });
      }
    }
  });

  // Manual investment tax calculation functions
  function calculateInvestmentStrategies(input: any) {
    const { 
      investmentAmount, 
      rrspRoom, 
      currentIncomeLevel, 
      withdrawalIncomeLevel, 
      timeline 
    } = input;

    const years = parseInt(timeline.replace(' years', ''));
    
    // For Corporate and Personal strategies, use full investment amount
    const corpAmount = investmentAmount;
    const corpFinalValue = corpAmount * Math.pow(1.07, years);
    const corpGains = corpFinalValue - corpAmount;
    
    // For RRSP strategy, use the amount that can actually be contributed
    const rrspAmount = Math.min(investmentAmount, rrspRoom);
    const rrspInitialValue = rrspAmount * Math.pow(1.07, years);
    const rrspInitialGains = rrspInitialValue - rrspAmount;

    // Tax rates based on Gemini's accurate calculations
    const getDividendRate = (income: string, isRetirement: boolean) => {
      if (isRetirement) {
        switch (income) {
          case "Under $50K": return 0.10;
          case "$50-100K": return 0.2028;
          case "$100-200K": return 0.30;
          case "Over $200K": return 0.35;
          default: return 0.2028;
        }
      } else {
        switch (income) {
          case "Under $50K": return 0.15;
          case "$50-100K": return 0.25;
          case "$100-200K": return 0.39;
          case "Over $200K": return 0.45;
          default: return 0.39;
        }
      }
    };

    const getPersonalTaxRate = (income: string) => {
      switch (income) {
        case "Under $50K": return 0.20;
        case "$50-100K": return 0.2965;
        case "$100-200K": return 0.35;
        case "Over $200K": return 0.45;
        default: return 0.2965;
      }
    };

    const getRrspRefundRate = (income: string) => {
      switch (income) {
        case "Under $50K": return 0.20;
        case "$50-100K": return 0.35;
        case "$100-200K": return 0.4116;
        case "Over $200K": return 0.50;
        default: return 0.4116;
      }
    };

    const currentDivRate = getDividendRate(currentIncomeLevel, false);
    const retirementDivRate = getDividendRate(withdrawalIncomeLevel, true);
    const personalTaxRate = getPersonalTaxRate(withdrawalIncomeLevel);
    const rrspRefundRate = getRrspRefundRate(currentIncomeLevel);

    // Strategy 1: Corporate Investment (with dividend refund) - Following Gemini's methodology
    const corpTaxableGains = corpGains * 0.5; // 50% inclusion
    const corpPassiveTax = corpTaxableGains * 0.5017; // 50.17% Ontario rate
    const refundableRDTOH = corpTaxableGains * 0.3067; // 30.67% refundable portion
    const dividendRefund = Math.min(refundableRDTOH, corpFinalValue * 0.3833); // Limited by dividend refund rate
    const netCorpTax = corpPassiveTax - dividendRefund;
    const availableForDividend = corpFinalValue - netCorpTax + dividendRefund; // Add back refund
    const personalDivTax = availableForDividend * retirementDivRate;
    const corpTotalTax = netCorpTax + personalDivTax;
    const corpFinalCash = availableForDividend - personalDivTax;

    // Strategy 2: Personal Investment
    const extractionTax = corpAmount * currentDivRate;
    const personalInvestment = corpAmount - extractionTax;
    const personalFinalValue = personalInvestment * Math.pow(1.07, years);
    const personalGains = personalFinalValue - personalInvestment;
    const personalCapGainsTax = personalGains * 0.5 * personalTaxRate;
    const personalTotalTax = extractionTax + personalCapGainsTax;
    const personalFinalCash = personalFinalValue - personalCapGainsTax;

    // Strategy 3: RRSP Strategy (only if RRSP room available)
    let rrspStrategy;
    if (rrspRoom > 0) {
      const rrspRefund = rrspAmount * rrspRefundRate;
      const refundFinalValue = rrspRefund * Math.pow(1.07, years);
      const rrspWithdrawalTax = rrspInitialValue * personalTaxRate;
      const refundGains = refundFinalValue - rrspRefund;
      const refundCapGainsTax = refundGains * 0.5 * personalTaxRate;
      const rrspTotalTax = rrspWithdrawalTax + refundCapGainsTax;
      const rrspFinalCash = (rrspInitialValue - rrspWithdrawalTax) + (refundFinalValue - refundCapGainsTax);
      
      rrspStrategy = {
        strategy: "RRSP Strategy",
        initialInvestment: `$${rrspAmount.toLocaleString()} (RRSP) + $${Math.round(rrspRefund).toLocaleString()} (Refund)`,
        finalValue: `$${Math.round(rrspInitialValue + refundFinalValue).toLocaleString()}`,
        totalTaxPaid: `$${Math.round(rrspTotalTax).toLocaleString()}`,
        finalCashInPocket: `$${Math.round(rrspFinalCash).toLocaleString()}`,
        effectiveTaxRate: `${((rrspTotalTax / (rrspInitialGains + refundGains)) * 100).toFixed(1)}%`,
        auditRisk: "2%"
      };
    } else {
      rrspStrategy = {
        strategy: "RRSP Strategy",
        initialInvestment: "Not Available",
        finalValue: "Not Available",
        totalTaxPaid: "Not Available",
        finalCashInPocket: "Not Available",
        effectiveTaxRate: "N/A",
        auditRisk: "N/A"
      };
    }

    return [
      {
        strategy: "Corporate Investment",
        initialInvestment: `$${corpAmount.toLocaleString()}`,
        finalValue: `$${Math.round(corpFinalValue).toLocaleString()}`,
        totalTaxPaid: `$${Math.round(corpTotalTax).toLocaleString()} (Passive: $${Math.round(netCorpTax).toLocaleString()} + Dividend: $${Math.round(personalDivTax).toLocaleString()})`,
        finalCashInPocket: `$${Math.round(corpFinalCash).toLocaleString()}`,
        effectiveTaxRate: `${((corpTotalTax / corpGains) * 100).toFixed(1)}%`,
        auditRisk: "5-10%"
      },
      {
        strategy: "Personal Investment",
        initialInvestment: `$${Math.round(personalInvestment).toLocaleString()}`,
        finalValue: `$${Math.round(personalFinalValue).toLocaleString()}`,
        totalTaxPaid: `$${Math.round(personalTotalTax).toLocaleString()}`,
        finalCashInPocket: `$${Math.round(personalFinalCash).toLocaleString()}`,
        effectiveTaxRate: `${((personalTotalTax / personalGains) * 100).toFixed(1)}%`,
        auditRisk: "5%"
      },
      rrspStrategy
    ];
  }

  // Investment strategy calculation
  app.post("/api/calculate-investment", async (req, res) => {
    try {
      
      // Validate input including user data
      const { investmentInputWithUserSchema } = await import("@shared/schema");
      const validatedInput = investmentInputWithUserSchema.parse(req.body);
      const { 
        investmentAmount, 
        rrspRoom, 
        currentIncomeLevel, 
        withdrawalIncomeLevel, 
        province, 
        timeline, 
        name, 
        email 
      } = validatedInput;

      // Calculate strategies using our accurate manual calculations
      const strategies = calculateInvestmentStrategies(validatedInput);

      // Create prompt for OpenAI to generate insights only
      const prompt = `You are a Canadian investment tax specialist. Generate strategic insights and explanations for these three investment approaches.

Client Profile:
- Available Corporate Retained Earnings: $${investmentAmount.toLocaleString()}
- Available RRSP Room: $${rrspRoom.toLocaleString()}
- Current Income: ${currentIncomeLevel}
- Expected Retirement Income: ${withdrawalIncomeLevel}
- Province: ${province}
- Timeline: ${timeline}

The three strategies being compared:

1. **Corporate Investment**: Keep funds in corporation, invest directly, pay passive investment tax, then extract as dividends at retirement
2. **Personal Investment**: Extract funds as dividends now, invest personally, pay capital gains tax later  
3. **RRSP Strategy**: Contribute to RRSP, invest the tax refund personally, withdraw at retirement

For EACH strategy, provide strategic insights in this JSON format:

{
  "insights": [
    {
      "strategy": "Corporate Investment",
      "description": "2-3 sentence strategic overview",
      "advantages": ["Key benefit 1", "Key benefit 2", "Key benefit 3"],
      "considerations": ["Important consideration 1", "Risk factor 2", "Limitation 3"],
      "bestFor": "Description of ideal client situation",
      "craCompliance": "CRA compliance notes and form references"
    }
  ]
}

Focus on:
- Strategic advantages and trade-offs
- Risk assessments and CRA compliance  
- When each strategy works best
- Practical implementation advice
- Tax planning insights

Do NOT include any dollar calculations - focus only on strategic insights and explanations.`;

      // Call dual AI service (Gemini primary for investment analysis)
      const aiResponse = await aiService.generateResponse(
        `You are a Canadian tax planning expert. Provide strategic insights and explanations without any dollar calculations. ${prompt}`,
        'investment_analysis'
      );

      if (!aiResponse.success) {
        throw new Error(aiResponse.error || 'AI service failed');
      }

      const rawResponse = aiResponse.content || "{}";
      console.log(`${aiResponse.provider.toUpperCase()} Insights Response:`, rawResponse);

      // Parse insights
      let insights;
      try {
        const parsedInsights = JSON.parse(rawResponse);
        insights = parsedInsights.insights || [];
      } catch (parseError) {
        console.error("Insights parse error:", parseError);
        // Fallback insights if AI fails
        insights = [
          {
            strategy: "Corporate Investment",
            description: "Leverages tax deferral within the corporation while maintaining investment growth potential.",
            advantages: ["Tax deferral benefits", "Dividend refund mechanism", "Flexible withdrawal timing"],
            considerations: ["Higher passive investment tax", "Dividend tax at withdrawal", "Complex tax calculations"],
            bestFor: "Business owners with stable corporate income seeking long-term growth",
            craCompliance: "Ensure proper passive income reporting and dividend refund calculations"
          },
          {
            strategy: "Personal Investment", 
            description: "Immediate extraction for personal investment with capital gains treatment.",
            advantages: ["Capital gains tax treatment", "Direct personal control", "Simpler tax structure"],
            considerations: ["Immediate dividend tax impact", "Reduced initial investment", "Higher current tax burden"],
            bestFor: "Individuals expecting lower future tax rates or needing immediate investment control",
            craCompliance: "Report dividend income and capital gains appropriately"
          },
          {
            strategy: "RRSP Strategy",
            description: "Maximizes registered account benefits with tax refund reinvestment.",
            advantages: ["Tax-deferred growth", "Tax refund reinvestment", "Retirement income splitting potential"],
            considerations: ["RRSP withdrawal as income", "Contribution room limits", "Age-based withdrawal requirements"],
            bestFor: "High-income earners with available RRSP room seeking maximum tax efficiency",
            craCompliance: "Monitor RRSP contribution limits and mandatory withdrawal requirements"
          }
        ];
      }

      // Combine manual calculations with AI insights and add recommendations
      const finalStrategies = strategies.map((strategy, index) => {
        const insight = insights[index];
        return {
          ...strategy,
          description: insight?.description || "Strategic investment approach with tax optimization benefits.",
          advantages: insight?.advantages || ["Tax efficiency", "Growth potential", "Strategic flexibility"],
          considerations: insight?.considerations || ["Tax implications", "Risk factors", "Implementation complexity"],
          bestFor: insight?.bestFor || "Business owners seeking tax-efficient investment strategies",
          craCompliance: insight?.craCompliance || "Ensure compliance with CRA regulations and reporting requirements",
          riskLevel: strategy.auditRisk === "2%" ? "Low" : strategy.auditRisk === "5%" ? "Medium" : "Medium-High",
          recommendation: ""
        };
      });

      // Sort strategies by cash value (highest first) and add recommendations
      const availableStrategies = finalStrategies.filter(s => s.finalCashInPocket !== "Not Available");
      const unavailableStrategies = finalStrategies.filter(s => s.finalCashInPocket === "Not Available");
      
      // Sort available strategies by cash value descending
      availableStrategies.sort((a, b) => {
        const cashA = parseFloat(a.finalCashInPocket.replace(/[$,]/g, ''));
        const cashB = parseFloat(b.finalCashInPocket.replace(/[$,]/g, ''));
        return cashB - cashA;
      });
      
      // Add recommendations
      availableStrategies.forEach((strategy, index) => {
        if (index === 0) {
          strategy.recommendation = "⭐ OPTIMAL - Highest after-tax return for your situation";
        } else {
          const optimalCash = parseFloat(availableStrategies[0].finalCashInPocket.replace(/[$,]/g, ''));
          const strategyCash = parseFloat(strategy.finalCashInPocket.replace(/[$,]/g, ''));
          const difference = optimalCash - strategyCash;
          strategy.recommendation = `Consider optimal strategy - potentially $${difference.toLocaleString()} more after-tax cash`;
        }
      });
      
      unavailableStrategies.forEach(strategy => {
        strategy.recommendation = "Not applicable - No RRSP contribution room available";
      });
      
      // Combine back into final result (keep original order)
      const sortedStrategies = [...availableStrategies, ...unavailableStrategies];

      // Store calculation in database
      const calculationData = {
        name: name,
        email: email,
        revenue: investmentAmount,
        expensesPercentage: 0,
        withdrawalAmount: 0,
        strategies: finalStrategies as any
      };

      // Skip database storage for now to avoid schema mismatch
      // await storage.createTaxCalculation(calculationData);

      res.json(sortedStrategies);
    } catch (error) {
      console.error("Investment calculation error:", error);
      
      if (error instanceof Error) {
        if (error.message.includes("parse") || error.message.includes("JSON")) {
          res.status(500).json({ 
            error: "Failed to process investment calculation. The AI service returned invalid data. Please try again." 
          });
        } else {
          res.status(400).json({ 
            error: error.message 
          });
        }
      } else {
        res.status(500).json({ 
          error: "An unexpected error occurred during investment calculation." 
        });
      }
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
