import { NextResponse } from 'next/server';
import { generateToken } from '../../../../lib/adminAuth';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export async function POST(request) {
    try {
        const { password } = await request.json();

        if (!password) {
            return NextResponse.json({
                error: 'Password required'
            }, { status: 400 });
        }

        if (password === ADMIN_PASSWORD) {
            const token = generateToken();

            return NextResponse.json({
                success: true,
                token: token,
                message: 'Authentication successful'
            });
        }

        return NextResponse.json({
            error: 'Invalid password'
        }, { status: 401 });

    } catch (error) {
        console.error('Admin auth error:', error);
        return NextResponse.json({
            error: 'Authentication failed'
        }, { status: 500 });
    }
}
