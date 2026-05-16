import { Parser } from 'expr-eval';

export class FormulaEngine {
  private parser: Parser;

  constructor() {
    this.parser = new Parser();
    
    // Add custom HR functions
    this.parser.functions.CHOOSE = function (idx: number, ...args: any[]) {
      return args[idx - 1] || 0;
    };
    
    this.parser.functions.IF = function (condition: any, trueVal: any, falseVal: any) {
      return condition ? trueVal : falseVal;
    };
    
    this.parser.functions.MAX = function (...args: any[]) {
        return Math.max(...args);
    };
    
    this.parser.functions.MIN = function (...args: any[]) {
        return Math.min(...args);
    };
  }

  /**
   * Safely evaluates an expression given a context.
   * @param expression The mathematical or logical string formula (e.g. "Basic * 0.12").
   * @param context An object dictionary containing the variables and their numeric values.
   * @returns The evaluated result or 0 on failure.
   */
  public evaluate(expression: string, context: Record<string, any> = {}): any {
    if (!expression) return 0;
    
    // Normalize basic operators where users might use "X = Y" instead of "X == Y"
    // Since expr-eval uses == for equality, we can do some basic replacement if needed, 
    // but expr-eval already handles '==' and '=' as equality in some contexts or we can just leave it.

    try {
      return this.parser.evaluate(expression, context);
    } catch (e: any) {
      console.warn(`Formula evaluation failed for expression: "${expression}"`, e.message);
      return 0; // Return safe default
    }
  }

  /**
   * Evaluates if a given formula string is syntactically valid.
   * @param expression The string expression to check.
   * @returns True if valid, false otherwise.
   */
  public isValid(expression: string): boolean {
    try {
      this.parser.parse(expression);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Extracts variables used in the expression.
   * @param expression The formula string.
   * @returns An array of string variable names found in the expressions.
   */
  public extractVariables(expression: string): string[] {
      try {
          const expr = this.parser.parse(expression);
          return expr.variables({ withMembers: false });
      } catch (e) {
          return [];
      }
  }
}

export const formulaEngine = new FormulaEngine();
