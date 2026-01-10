// app/api/admin/links/route.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { collection, getDocs, deleteDoc, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../../../lib/firebase';

// Simple auth check
import { verifyToken } from '../../../../lib/adminAuth';

// Simple auth check
function isAuthenticated(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

    const token = authHeader.split(' ')[1];
    return verifyToken(token);
}

export async function GET(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const q = query(collection(db, 'shared_links'), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        const links = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt || null
        }));

        return NextResponse.json({ links });

    } catch (error) {
        console.error('Failed to fetch links:', error);
        return NextResponse.json({ error: 'Failed to fetch links', details: error.message }, { status: 500 });
    }
}

export async function DELETE(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { linkId } = await request.json();

        if (!linkId) {
            return NextResponse.json({ error: 'Link ID required' }, { status: 400 });
        }

        await deleteDoc(doc(db, 'shared_links', linkId));

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Failed to delete link:', error);
        return NextResponse.json({ error: 'Failed to delete link', details: error.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    if (!isAuthenticated(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { linkId, updates } = await request.json();

        if (!linkId || !updates) {
            return NextResponse.json({ error: 'Link ID and updates required' }, { status: 400 });
        }

        // Only allow specific fields to be updated
        const allowedFields = ['message', 'status', 'from', 'url', 'tags', 'isVerified'];
        const cleanUpdates = {};

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                // Handle tags as array
                if (field === 'tags' && Array.isArray(updates[field])) {
                    cleanUpdates[field] = updates[field];
                }
                // Handle isVerified as boolean
                else if (field === 'isVerified') {
                    cleanUpdates[field] = Boolean(updates[field]);
                }
                // Other fields as trimmed strings
                else if (field !== 'tags') {
                    cleanUpdates[field] = String(updates[field]).trim().substring(0, 2000);
                }
            }
        }

        await updateDoc(doc(db, 'shared_links', linkId), cleanUpdates);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Failed to update link:', error);
        return NextResponse.json({ error: 'Failed to update link', details: error.message }, { status: 500 });
    }
}

