import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
})

export const config = {
  matcher: [
    /*
     * Protect all routes EXCEPT:
     * - /login             (sign-in page)
     * - /api/auth/*        (NextAuth OAuth handlers)
     * - /confidentialite   (legal page)
     * - /cgu               (legal page)
     * - /_next/*           (Next.js internals)
     * - /favicon.ico
     */
    '/((?!login|api/auth|confidentialite|cgu|_next|favicon\\.ico).*)',
  ],
}
