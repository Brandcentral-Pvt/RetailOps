import {
    ClerkProvider,
    SignInButton,
    SignUpButton,
    SignedIn,
    SignedOut,
    UserButton,
} from "@clerk/nextjs";
import 'bootstrap/dist/css/bootstrap.min.css';
import "../src/index.css";

export const metadata = {
    title: "GMS Dashboard",
    description: "Next.js GMS Dashboard with Clerk",
};

export default function RootLayout({ children }) {
    return (
        <ClerkProvider>
            <html lang="en">
                <body>
                    {/* We'll move the Header component logic into layout or keep it separate */}
                    {children}
                </body>
            </html>
        </ClerkProvider>
    );
}
