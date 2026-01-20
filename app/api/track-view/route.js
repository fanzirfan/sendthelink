export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request) {
    try {
        const { linkId } = await request.json();

        if (!linkId || typeof linkId !== 'string') {
            return NextResponse.json({ error: 'Valid Link ID required' }, { status: 400 });
        }

        const linkRef = doc(db, 'shared_links', linkId);
        
        // Atomically increment the views counter
        await updateDoc(linkRef, {
            views: increment(1)
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Track view error:', error);
        // Fail silently to not disrupt the user experience, but log on server
        return NextResponse.json({ error: 'Failed to track view' }, { status: 500 });
    }
}
