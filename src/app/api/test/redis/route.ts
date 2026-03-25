import { NextRequest, NextResponse } from 'next/server';
import * as userCache from '@/lib/userCache';

/**
 * POST: Test userCache functions
 * 
 * Request body format:
 * {
 *   action: 'get' | 'delete',
 *   function: 'userType' | 'userLevel' | 'userPath' | 'userSuperior' | 'userMining' | 'userTotalPerformance',
 *   address: string,
 *   all?: boolean // If true, will get/delete all keys of the specified function type
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, function: funcName, address, id } = body;

        // Validate required parameters
        if (!action || !funcName) {
            return NextResponse.json(
                { success: false, error: 'Missing required parameters: action and function' },
                { status: 400 }
            );
        }

        // Validate action
        if (action !== 'get' && action !== 'delete') {
            return NextResponse.json(
                { success: false, error: 'Invalid action. Must be "get" or "delete"' },
                { status: 400 }
            );
        }

        // Handle the request based on action and function
        if (action === 'get') {
            return await handleGetRequest(funcName, address, id);
        } else { // action === 'delete'
            return await handleDeleteRequest(funcName, address);
        }
    } catch (error) {
        console.error('Error in userCache test API:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to process request' },
            { status: 500 }
        );
    }
}

/**
 * Handle GET requests for userCache functions
 */
async function handleGetRequest(funcName: string, userAddress?: string, id?: string) {
    // If userAddress is not provided and all is not true, return error
    if (!userAddress && !id) {
        return NextResponse.json(
            { success: false, error: 'Address is required for get operations unless all=true' },
            { status: 400 }
        );
    }

    try {
        // Handle different function types
        switch (funcName) {
            case 'userAddress':
                const address = await userCache.getUserAddressById(id!);
                return NextResponse.json({ success: true, data: { address } });
            case 'userType':
                const type = await userCache.getUserType(userAddress!);
                return NextResponse.json({ success: true, data: { type } });

            // case 'userLevel':
            //     const level = await userCache.getUserLevel(userAddress!);
            //     return NextResponse.json({ success: true, data: { level } });

            case 'userPath':
                const path = await userCache.getUserPath(userAddress!);
                return NextResponse.json({ success: true, data: { path } });

            case 'userSuperior':
                const superior = await userCache.getUserSuperior(userAddress!);
                return NextResponse.json({ success: true, data: { superior } });

            // case 'userMining':
            //     const mining = await userCache.getUserMining(userAddress!);
            //     return NextResponse.json({ success: true, data: { mining: mining.toString() } });

            case 'userTotalPerformance':
                const performance = await userCache.getUserTotalPerformance(userAddress!);
                return NextResponse.json({ success: true, data: { performance: performance.toString() } });

            default:
                return NextResponse.json(
                    { success: false, error: `Unknown function: ${funcName}` },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error(`Error getting ${funcName}:`, error);
        return NextResponse.json(
            { success: false, error: `Failed to get ${funcName}` },
            { status: 500 }
        );
    }
}

/**
 * Handle DELETE requests for userCache functions
 */
async function handleDeleteRequest(funcName: string, address?: string, all?: boolean) {
    // If address is not provided and all is not true, return error
    if (!address) {
        return NextResponse.json(
            { success: false, error: 'Address is required for delete operations unless all=true' },
            { status: 400 }
        );
    }

    try {
        // Handle different function types
        switch (funcName) {
            case 'userType':
                await userCache.cleanUserType(address!);
                return NextResponse.json({ success: true, message: `Deleted userType for address: ${address}` });

            case 'userLevel':
                await userCache.cleanUserLevel(address!);
                return NextResponse.json({ success: true, message: `Deleted userLevel for address: ${address}` });

            case 'userMining':
                await userCache.cleanUserMining(address!);
                return NextResponse.json({ success: true, message: `Deleted userMining for address: ${address}` });

            case 'userTotalPerformance':
                await userCache.cleanUserTotalPerformance(address!);
                return NextResponse.json({ success: true, message: `Deleted userTotalPerformance for address: ${address}` });

            default:
                return NextResponse.json(
                    { success: false, error: `Unknown function or function does not support cleaning: ${funcName}` },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error(`Error deleting ${funcName}:`, error);
        return NextResponse.json(
            { success: false, error: `Failed to delete ${funcName}` },
            { status: 500 }
        );
    }
}