import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PageEditor from "../components/PageEditor";
import { PageState, BlockLayout, TextStyle, EventType } from "../types";

interface EditPageProps {
    params: Promise<{ id: string }>;
}

export default async function EditPage({ params }: EditPageProps) {
    const { id } = await params;

    const page = await prisma.eventPage.findUnique({
        where: { id },
        include: {
            blocks: {
                orderBy: { order: 'asc' }
            }
        }
    });

    if (!page) {
        notFound();
    }

    // Transform Prisma data to PageState
    const initialData: PageState & { id: string, slug: string } = {
        id: page.id,
        slug: page.slug,
        title: page.title,
        eventType: page.eventType as EventType,
        isPublished: page.isPublished,
        blocks: page.blocks.map(block => ({
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
        }))
    };

    return <PageEditor initialData={initialData} isEditing={true} />;
}
