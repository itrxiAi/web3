import { NextRequest, NextResponse } from 'next/server';
import { operationControl, validateBearerToken } from '@/utils/auth';
//import { assemble } from '@/lib/balance';
import decimal from 'decimal.js';
import { getHotWalletAddress } from '@/lib/config';

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { amount, tokenType } = body;

    const validationResponse = validateBearerToken(req);
    if (validationResponse) {
      return validationResponse;
    }
    
    // const txHash = await assemble({
    //   amount: new decimal(amount),
    //   tokenType,
    //   address: (await getHotWalletAddress()).toString()
    // });
    // return NextResponse.json({
    //   txHash,
    //   success: true
    // });
}
