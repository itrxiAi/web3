import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { validateBearerToken } from '@/utils/auth';
import { TxFlowStatus } from '@prisma/client';
import { verifyChainTransfer, verifyTokenTransfer } from '@/utils/chain';
import Decimal from 'decimal.js';

export async function POST(req: NextRequest) {

  try {
    const { transactionId, txHash } = await req.json();

    // Validate input parameters
    if (!transactionId || !txHash) {
      return NextResponse.json(
        { error: 'Missing required parameters: transactionId and txHash' },
        { status: 400 }
      );
    }

    // Validate transaction ID
    const txId = typeof transactionId === 'string' ? parseInt(transactionId, 10) : transactionId;
    if (isNaN(txId)) {
      return NextResponse.json(
        { error: 'Invalid transaction ID. Must be a number.' },
        { status: 400 }
      );
    }

    // Validate transaction hash format (basic validation)
    if (typeof txHash !== 'string' || txHash.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid transaction hash. Must be a non-empty string.' },
        { status: 400 }
      );
    }

    // Check if transaction exists and is in auditing status
    const existingTransaction = await prisma.transaction.findUnique({
      where: { id: txId }
    });

    if (!existingTransaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    if (existingTransaction.status !== TxFlowStatus.AUDITING) {
      return NextResponse.json(
        { error: 'Transaction is not in auditing status and cannot be updated' },
        { status: 400 }
      );
    }

    // Verify the transaction hash on blockchain
    const transferResult = await verifyChainTransfer(txHash, existingTransaction.tokenType);
    
    if (!transferResult.success) {
      return NextResponse.json(
        { error: `Transaction verification failed: ${transferResult.error}` },
        { status: 400 }
      );
    }

    // Verify the transaction details match our records
    const expectedFromAddress = existingTransaction.fromAddress?.toLowerCase();
    const expectedToAddress = existingTransaction.toAddress?.toLowerCase();
    const actualFromAddress = transferResult.fromAddress?.toLowerCase();
    const actualToAddress = transferResult.toAddress?.toLowerCase();

    // if (expectedFromAddress && actualFromAddress !== expectedFromAddress) {
    //   return NextResponse.json(
    //     { error: `Transaction from address mismatch. Expected: ${expectedFromAddress}, Actual: ${actualFromAddress}` },
    //     { status: 400 }
    //   );
    // }

    if (expectedToAddress && actualToAddress !== expectedToAddress) {
      return NextResponse.json(
        { error: `Transaction to address mismatch. Expected: ${expectedToAddress}, Actual: ${actualToAddress}` },
        { status: 400 }
      );
    }

    // Verify the amount matches (allowing for small decimal differences due to conversion)
    const expectedAmount = new Decimal(existingTransaction.amount.toString());
    const actualAmount = new Decimal(transferResult.amount?.toString() || '0');
    
    // Convert actual amount from wei to proper decimals based on token type
    const TOKEN_DECIMAL = 18
    const actualAmountFormatted = actualAmount.div(new Decimal(10).pow(TOKEN_DECIMAL));
    
    // Allow for small rounding differences (0.01 tolerance)
    const amountDifference = expectedAmount.minus(actualAmountFormatted).abs();
    if (amountDifference.gt(new Decimal('0.01'))) {
      return NextResponse.json(
        { error: `Transaction amount mismatch. Expected: ${expectedAmount.toString()}, Actual: ${actualAmountFormatted.toString()}` },
        { status: 400 }
      );
    }

    // Update the transaction with the new hash and change status to confirmed
    const updatedTransaction = await prisma.transaction.update({
      where: { id: txId },
      data: {
        txHash: txHash.trim(),
        status: TxFlowStatus.CONFIRMED,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Transaction hash updated successfully',
      transaction: updatedTransaction
    });

  } catch (error) {
    console.error('Error updating transaction hash:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}