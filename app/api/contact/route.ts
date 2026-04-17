import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, contact, message, eventType, date } = body;

        // Validate required fields
        if (!name || !contact) {
            return NextResponse.json(
                { error: 'Name and contact are required' },
                { status: 400 }
            );
        }
        
        let dbSaved = false;
        let emailSent = false;

        // 1. Dual-Fallback: Try saving to Prisma first
        try {
            await prisma.bookingRequest.create({
                data: {
                    name,
                    contact,
                    message: message || null,
                    eventType: eventType || null,
                    date: date || null,
                }
            });
            dbSaved = true;
        } catch (error) {
            console.error('Error saving to DB (Prisma Fallback Triggered):', error);
        }

        // 2. Try sending Email
        try {
            const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: parseInt(process.env.SMTP_PORT || '587'),
                secure: false, // true for 465, false for other ports
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            const mailOptions = {
                from: process.env.SMTP_USER,
                to: process.env.RECIPIENT_EMAIL,
                subject: `New Contact Form Submission from ${name}`,
                html: `
                    <h2>New Contact Form Submission</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Contact:</strong> ${contact}</p>
                    ${eventType ? `<p><strong>Event Type:</strong> ${eventType}</p>` : ''}
                    ${date ? `<p><strong>Date:</strong> ${date}</p>` : ''}
                    ${message ? `<p><strong>Message:</strong></p><p>${message.replace(/\n/g, '<br>')}</p>` : ''}
                    <hr>
                    <p><small>Sent from Mindra Website Contact Form</small></p>
                `,
            };

            await transporter.sendMail(mailOptions);
            emailSent = true;
        } catch (error) {
            console.error('Error sending email (DLQ Fallback Triggered):', error);
        }

        // 3. Evaluation
        if (!dbSaved && !emailSent) {
            // Both fallbacks failed
            console.error('CRITICAL: Both DB and Email failed for lead:', name, contact);
            return NextResponse.json(
                { error: 'Failed to process request entirely' },
                { status: 500 }
            );
        }

        // Return 200 if at least one method succeeded
        return NextResponse.json(
            { 
                message: 'Request processed successfully', 
                status: { db: dbSaved, email: emailSent }
            },
            { status: 200 }
        );
    } catch (error) {
        console.error('Fatal Route Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
