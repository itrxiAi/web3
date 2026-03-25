import { NextRequest, NextResponse } from 'next/server';
import { validateBearerToken } from '@/utils/auth';
//import { auditionOutPassed, auditionOutRefused } from '@/lib/balance';

export async function POST(req: NextRequest) {

    const validationResponse = validateBearerToken(req);
    if (validationResponse) {
        return validationResponse;
    }

    const { txId, pass } = await req.json();
    try {
        // Parse txId as a number to ensure correct type
        const txIdNumber = parseInt(txId, 10);
        
        // Validate that txId is a valid number
        if (isNaN(txIdNumber)) {
            return NextResponse.json(
                { error: 'Invalid transaction ID. Must be a number.' },
                { status: 400 }
            );
        }
        
        // if (!pass) {
        //     await auditionOutRefused(txIdNumber);
        //     return NextResponse.json({
        //         status: 'success',
        //         message: ''
        //     });
        // } else {
        //     const txHash = await auditionOutPassed(txIdNumber);
        //     if (txHash) {
        //         return NextResponse.json({
        //             status: 'success',
        //             message: `${txHash}`
        //         });
        //     }
        // }
    } catch (error) {
        console.error('Transaction auditing error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error occurred' },
            { status: 500 }
        );
    }
}
