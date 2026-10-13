import { proxyCartRequest } from "@/app/lib/cart-proxy";

type RouteContext = {
  params: Promise<{ itemId: string }>;
};

export async function PATCH(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { itemId } = await params;
  return proxyCartRequest(
    `cart/items/${encodeURIComponent(itemId)}`,
    request,
  );
}

export async function DELETE(
  request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { itemId } = await params;
  return proxyCartRequest(
    `cart/items/${encodeURIComponent(itemId)}`,
    request,
  );
}
