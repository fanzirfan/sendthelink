// app/api/admin/auth/route.js
import { NextResponse } from 'next/server';

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
            // In production, you'd want to use JWT tokens or sessions
            // For now, we'll just return success and let client store auth state
            return NextResponse.json({
                success: true,
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
