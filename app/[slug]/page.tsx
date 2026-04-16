import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BlockDisplay from "@/app/components/BlockDisplay";
import { PageBlock, TextStyle, BlockLayout, EventType } from "@/app/admin/types";

interface PageProps {
    params: Promise<{ slug: string }>;
}

async function getPage(slug: string) {
    const page = await prisma.eventPage.findUnique({
        where: { slug },
        include: {
            blocks: {
                orderBy: { order: 'asc' }
            }
        }
    });

    return page;
}

export async function generateMetadata({ params }: PageProps) {
    const { slug } = await params;
    const page = await getPage(slug);

    if (!page) {
        return {
            title: 'Page Not Found',
        };
    }

    return {
        title: page.title,
        description: `Event page for ${page.title}`,
    };
}

export default async function EventPage({ params }: PageProps) {
    const { slug } = await params;
    const page = await getPage(slug);

    if (!page) {
        notFound();
    }

    // Map Prisma blocks to PageBlock interface
    const blocks: PageBlock[] = page.blocks.map(block => ({
        id: block.id,
        layout: block.layout as BlockLayout,
        content: {
            text: block.text || '',
            textStyle: block.textStyle ? JSON.parse(block.textStyle) as TextStyle : {
                align: 'left',
                size: 'base',
                family: 'sans',
                bold: false,
                italic: false,
                color: '#333333'
            },
            mediaUrl: block.mediaUrl,
            mediaType: block.mediaType as 'image' | 'video' | null
        }
    }));

    // Theme Config based on Event Type
    const getTheme = (type: string) => {
        switch (type) {
            case 'wedding':
                return {
                    bg: 'bg-[#faf7f2]',
                    font: 'font-serif',
                    titleColor: 'text-rose-900'
                };
            case 'party':
                return {
                    bg: 'bg-slate-900',
                    font: 'font-mono',
                    titleColor: 'text-purple-400'
                };
            case 'business':
            default:
                return {
                    bg: 'bg-gray-50',
                    font: 'font-sans',
                    titleColor: 'text-blue-900'
                };
        }
    };

    const theme = getTheme(page.eventType);

    return (
        <div className={`min-h-screen ${theme.bg} ${page.eventType === 'party' ? 'text-white' : 'text-gray-900'}`}>

            {/* Hero / Title Section */}
            <header className="w-full py-20 px-4 text-center">
                <h1 className={`text-4xl md:text-6xl lg:text-7xl font-bold mb-4 ${theme.titleColor} ${theme.font}`}>
                    {page.title}
                </h1>
                <div className={`w-24 h-1 mx-auto rounded-full ${page.eventType === 'party' ? 'bg-purple-500' :
                        page.eventType === 'wedding' ? 'bg-rose-300' : 'bg-blue-300'
                    }`} />
            </header>

            {/* Blocks */}
            <main>
                {blocks.map((block) => (
                    <BlockDisplay key={block.id} block={block} />
                ))}
            </main>

            {/* Footer */}
            <footer className="py-12 text-center opacity-50 text-sm">
                <p>© {new Date().getFullYear()} Mindra Events</p>
            </footer>
        </div>
    );
}
