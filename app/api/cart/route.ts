import { proxyCartRequest } from "@/app/lib/cart-proxy";

export async function GET(request: Request): Promise<Response> {
  return proxyCartRequest("cart", request);
}

export async function POST(request: Request): Promise<Response> {
  return proxyCartRequest("cart/items", request);
}
