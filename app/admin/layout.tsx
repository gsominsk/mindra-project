import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Mindra Admin - PageBuilder",
    description: "Admin panel for Mindra event pages",
    robots: {
        index: false,
        follow: false,
    },
};

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen">
            {children}
        </div>
    );
}
