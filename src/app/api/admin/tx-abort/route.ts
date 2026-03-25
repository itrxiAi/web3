import { NextRequest, NextResponse } from 'next/server';
import { validateBearerToken } from '@/utils/auth';
//import { manualOutAbort } from '@/tasks/out';

export async function POST(req: NextRequest) {

    const validationResponse = validateBearerToken(req);
    if (validationResponse) {
      return validationResponse;
    }
    
    const { txId, pointsBack } = await req.json();
    try {
        //const success = await manualOutAbort(txId, pointsBack);
        // if (success) {
        //     return NextResponse.json({
        //         status: 'success',
        //         message: 'Transaction aborted'
        //     });
        // }
        return NextResponse.json({
            status: 'failed',
            message: 'Transaction aborted'
        });
    } catch (error) {
        console.error('Transaction abort error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error occurred' },
            { status: 500 }
        );
    }


}
