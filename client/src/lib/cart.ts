export interface CartLine {
  productId: string;
  quantity: number;
}

export function loadCart(brandId?: string): CartLine[] {
  if (!brandId) return [];
  try {
    return JSON.parse(localStorage.getItem(`sw.cart.${brandId}`) || "[]") as CartLine[];
  } catch {
    return [];
  }
}

export function saveCart(brandId: string | undefined, lines: CartLine[]) {
  if (!brandId) return;
  localStorage.setItem(`sw.cart.${brandId}`, JSON.stringify(lines));
}

export function clearCart(brandId: string | undefined) {
  if (!brandId) return;
  localStorage.removeItem(`sw.cart.${brandId}`);
}
