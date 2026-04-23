/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  expiry: string;
  category: string;
  quantity: string;
  unit: string;
}

export type Category = 
  | "Alimentação" 
  | "Bebidas" 
  | "Laticínios" 
  | "Medicamentos" 
  | "Higiene" 
  | "Limpeza" 
  | "Outro";

export const CATEGORY_ICONS: Record<string, string> = {
  "Alimentação": "🥫",
  "Bebidas": "🧃",
  "Laticínios": "🧀",
  "Medicamentos": "💊",
  "Higiene": "🧴",
  "Limpeza": "🧹",
  "Outro": "📦"
};
