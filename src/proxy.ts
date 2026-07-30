import { NextRequest, NextResponse } from "next/server";

// Protege el panel interno de leads (/admin) con autenticación básica.
// No toca las rutas del chatbot público.
export function proxy(request: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  if (!user || !pass) {
    return new NextResponse(
      "Panel no configurado: faltan las variables de entorno ADMIN_USER / ADMIN_PASSWORD.",
      { status: 500 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = atob(auth.slice("Basic ".length));
    const separatorIndex = decoded.indexOf(":");
    const providedUser = decoded.slice(0, separatorIndex);
    const providedPass = decoded.slice(separatorIndex + 1);
    if (providedUser === user && providedPass === pass) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Autenticación requerida.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Panel de leads"' },
  });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
