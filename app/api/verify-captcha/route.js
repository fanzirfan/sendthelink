// app/api/verify-captcha/route.js
import { NextResponse } from 'next/server';

const RECAPTCHA_SECRET_KEY = process.env.RECAPTCHA_SECRET_KEY;
const MIN_SCORE = parseFloat(process.env.RECAPTCHA_MIN_SCORE || '0.5');

export async function POST(request) {
    try {
        const { token } = await request.json();

        if (!token) {
            // No token provided - might be dev mode
            console.warn('⚠️ No reCAPTCHA token provided');
            return NextResponse.json({
                success: true,
                score: 1.0,
                warning: 'No CAPTCHA token (dev mode)'
            });
        }

        if (!RECAPTCHA_SECRET_KEY) {
            console.warn('⚠️ RECAPTCHA_SECRET_KEY not set - Running in DEV MODE without CAPTCHA protection');
            return NextResponse.json({
                success: true,
                score: 1.0,
                devMode: true
            });
        }

        // Verify token with Google reCAPTCHA
        const response = await fetch(
            'https://www.google.com/recaptcha/api/siteverify',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: `secret=${RECAPTCHA_SECRET_KEY}&response=${token}`
            }
        );

        const data = await response.json();

        if (!data.success) {
            // Check if it's a localhost/development issue
            const errorCodes = data['error-codes'] || [];
            console.warn('reCAPTCHA verification failed:', errorCodes);

            // Common localhost/dev errors that should not block
            const devErrors = ['missing-input-secret', 'invalid-input-response', 'hostname', 'browser-error'];
            const isDevError = errorCodes.some(code =>
                devErrors.some(devErr => code.includes(devErr))
            );

            if (isDevError) {
                console.warn('⚠️ reCAPTCHA localhost/hostname issue - Allowing in DEV MODE');
                return NextResponse.json({
                    success: true,
                    score: 0.8,
                    warning: 'CAPTCHA verification skipped (localhost/dev mode)'
                });
            }

            // Real verification failure
            return NextResponse.json({
                success: false,
                error: 'reCAPTCHA verification failed',
                errorCodes
            }, { status: 400 });
        }

        // Check score (reCAPTCHA v3 provides a score from 0.0 to 1.0)
        const score = data.score || 0;

        if (score < MIN_SCORE) {
            return NextResponse.json({
                success: false,
                error: 'reCAPTCHA score too low (possible bot)',
                score
            }, { status: 403 });
        }

        return NextResponse.json({
            success: true,
            score
        });

    } catch (error) {
        console.error('reCAPTCHA verification error:', error);
        // Fail open - allow submission if reCAPTCHA service is down
        return NextResponse.json({
            success: true,
            score: 1.0,
            warning: 'Verification service unavailable (allowed)'
        });
    }
}
