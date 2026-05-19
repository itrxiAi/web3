import { verifyMessage, keccak256, toBytes } from 'viem';
import bs58 from 'bs58';
import { TokenType, TxFlowType } from '@prisma/client';
import { ExpiringMap } from '@/utils/expiringMap';
import { MAX_TIMESTAMP_GAP_MS } from '@/constants';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';

// Use global TextEncoder
const encoder = new TextEncoder();

export const operationControl = new ExpiringMap<string, boolean>(MAX_TIMESTAMP_GAP_MS);

interface TokenPayload {
  walletAddress: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
  jti?: string;
  iss?: string;
  aud?: string;
  sub?: string;
}

export async function generateOperationHash(
  params: {
    operationType: string,
    amount: number,
    tokenType?: TokenType,
    description?: string,
    walletAddress: string,
    timestamp: number
  }
): Promise<string> {
  const { operationType, amount, walletAddress, timestamp, description, tokenType } = params;
  const data = `${timestamp}:${operationType}:${amount}:${walletAddress}:${description || ''}:${tokenType || TokenType.HAK}`;
  const hash = crypto.createHash('sha256').update(data).digest();
  return bs58.encode(new Uint8Array(hash));
}

export function hexToUint8Array(hexString: string): Uint8Array {
  const pairs = hexString.match(/[\dA-F]{2}/gi) || [];
  return new Uint8Array(
    pairs.map(s => parseInt(s, 16))
  );
}

export async function verifySignature(
  walletAddress: string,
  signatureString: string,
  message: string
): Promise<boolean> {
  try {
    // Verify the signature using viem
    const isValid = await verifyMessage({
      address: walletAddress as `0x${string}`,
      message: message,
      signature: signatureString as `0x${string}`,
    });
    
    return isValid;
  } catch (error) {
    console.error('Backend - Ethereum signature verification error:', error);
    return false;
  }
}

// export async function isInBlacklist(address: string) {
//   const user = await prisma.user.findUnique({
//     where: { address },
//     select: { blacklist: true }
//   });

//   return user?.blacklist === true;
// }

/**
 * Set ban status
 * @param address 
 * @returns 
 */
// export async function setBanStatus(address: string, ban: boolean): Promise<boolean> {
//   try {
//     await prisma.user_info.update({
//       where: { address },
//       data: { blacklist: ban ? true : null }
//     });
//     return true;
//   } catch (error) {
//     console.log(`Ban user error: ${error}`);
//     return false;
//   }
// }

export function validateBearerToken(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('Authorization');

  // Check if auth header exists and starts with 'Bearer '
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authorization header is required' },
      { status: 401 }
    );
  }

  // Extract the token
  const token = authHeader.split(' ')[1];

  // Verify the token matches our expected token
  if (token !== process.env.AUTH_BEARER) {
    return NextResponse.json(
      { error: 'Invalid authentication token' },
      { status: 401 }
    );
  }

  return null; // null means validation passed
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    const decoded = JSON.parse(atob(token));
    const currentTime = Date.now();

    // Check if token is expired
    if (decoded.exp && decoded.exp * 1000 < currentTime) {
      return false;
    }

    // Additional token validation logic here
    // You might want to check the wallet address, signature, etc.

    return true;
  } catch {
    return false;
  }
}

const SHORTCODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32, no 0/O/1/I/L/U
const SHORTCODE_LEN = 8;

export function randomReferralCode(address: string): string {
  const hash: `0x${string}` = keccak256(toBytes(address.toLowerCase()));
  const bytes = Buffer.from(hash.slice(2), 'hex');
  let big = BigInt(0);
  for (let i = 0; i < 5; i++) big = (big << BigInt(8)) | BigInt(bytes[i]);
  const mask = BigInt(SHORTCODE_ALPHABET.length - 1);
  let out = '';
  for (let i = 0; i < SHORTCODE_LEN; i++) {
    out = SHORTCODE_ALPHABET[Number(big & mask)] + out;
    big >>= BigInt(5);
  }
  return out;
}