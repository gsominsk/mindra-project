import React from 'react';
import { PageBlock, TextStyle } from '../admin/types';

interface BlockDisplayProps {
    block: PageBlock;
}

const BlockDisplay: React.FC<BlockDisplayProps> = ({ block }) => {
    const getFontFamily = (family: string) => {
        switch (family) {
            case 'serif': return 'font-serif';
            case 'mono': return 'font-mono';
            default: return 'font-sans';
        }
    };

    const getFontSize = (size: string) => {
        switch (size) {
            case 'sm': return 'text-sm';
            case 'lg': return 'text-lg';
            case 'xl': return 'text-xl';
            case '2xl': return 'text-2xl';
            case '4xl': return 'text-4xl';
            default: return 'text-base';
        }
    };

    const textContent = (
        <div
            className={`w-full h-full p-4
        ${getFontFamily(block.content.textStyle.family)}
        ${getFontSize(block.content.textStyle.size)}
        ${block.content.textStyle.bold ? 'font-bold' : 'font-normal'}
        ${block.content.textStyle.italic ? 'italic' : 'not-italic'}
      `}
            style={{
                textAlign: block.content.textStyle.align,
                color: block.content.textStyle.color,
                whiteSpace: 'pre-wrap'
            }}
        >
            {block.content.text}
        </div>
    );

    const mediaContent = block.content.mediaUrl ? (
        <div className="w-full h-full min-h-[200px] md:min-h-[400px] flex items-center justify-center overflow-hidden rounded-lg">
            {block.content.mediaType === 'video' ? (
                <video src={block.content.mediaUrl} controls className="w-full h-full object-cover" />
            ) : (
                <img src={block.content.mediaUrl} alt="Block media" className="w-full h-full object-cover" />
            )}
        </div>
    ) : null;

    return (
        <div className="w-full max-w-7xl mx-auto py-12 px-4 md:px-6">
            <div className={`grid gap-8 items-center ${block.layout === 'media-left' ? 'grid-cols-1 md:grid-cols-2' :
                    block.layout === 'media-right' ? 'grid-cols-1 md:grid-cols-2' :
                        'grid-cols-1'
                }`}>

                {block.layout === 'media-left' && (
                    <>
                        <div className="order-1">{mediaContent}</div>
                        <div className="order-2">{textContent}</div>
                    </>
                )}

                {block.layout === 'media-right' && (
                    <>
                        <div className="order-2 md:order-1">{textContent}</div>
                        <div className="order-1 md:order-2">{mediaContent}</div>
                    </>
                )}

                {block.layout === 'media-only' && (
                    <div className="w-full max-w-5xl mx-auto">{mediaContent}</div>
                )}

                {block.layout === 'text-only' && (
                    <div className="w-full max-w-4xl mx-auto">{textContent}</div>
                )}

            </div>
        </div>
    );
};

export default BlockDisplay;
