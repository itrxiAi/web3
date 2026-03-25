import { NextRequest, NextResponse } from 'next/server';
//import { calculateAllStaticRewards, handleStaticDynamicRewardBatch, updateDynamicRewards } from '@/tasks/reward';
import { initCronJobs, settlement } from '@/tasks';
//import { reRankAllUsers } from '@/tasks/user';
import { validateBearerToken } from '@/utils/auth';

// Initialize cron jobs once when this module is loaded
// This will only run once per server instance thanks to our global flag

export async function POST(req: NextRequest) {
    initCronJobs().catch(error => console.error('Failed to initialize cron jobs:', error));


    const validationResponse = validateBearerToken(req);
    if (validationResponse) {
      return validationResponse;
    }
    
    const { func, year, month, day } = await req.json();
    // Use provided date parameters directly if available
    const utcYear = year ?? new Date().getUTCFullYear();
    const utcMonth = month ?? new Date().getUTCMonth() + 1; // Months are 0-based in JS
    const utcDay = day ?? new Date().getUTCDate();
    console.log(`manual task ${func} at ${utcYear}-${utcMonth}-${utcDay}`);

    try {

        switch (func) {
            case 'settlement':
                console.log('manual task settlement', utcYear, utcMonth, utcDay);
                await settlement(utcYear, utcMonth, utcDay);
                return NextResponse.json({
                    status: 'success',
                    message: 'Settlement completed'
                });
            case 'reRankAllUsers':
                console.log('manual task reRankAllUsers', utcYear, utcMonth, utcDay);
                //await reRankAllUsers(utcYear, utcMonth, utcDay);
                return NextResponse.json({
                    status: 'success',
                    message: 'Re-ranking completed'
                });
            case 'calculateAllStaticRewards':
                console.log('manual task calculateAllStaticRewards', utcYear, utcMonth, utcDay);
                //await calculateAllStaticRewards(utcYear, utcMonth, utcDay);
                return NextResponse.json({
                    status: 'success',
                    message: 'Static rewards calculation completed'
                });

            case 'updateDynamicRewards':
                console.log('manual task updateAllSuperiorDynamicRewards', utcYear, utcMonth, utcDay);
                //await updateDynamicRewards(utcYear, utcMonth, utcDay);
                return NextResponse.json({
                    status: 'success',
                    message: 'Superior dynamic rewards update completed'
                });
            /* case 'handleStaticDynamicRewardBatch':
                console.log('manual task handleStaticDynamicRewardBatch', utcYear, utcMonth, utcDay);
                await handleStaticDynamicRewardBatch();
                return NextResponse.json({
                    status: 'success',
                    message: 'Static dynamic reward batch processing completed'
                }); */
            // case 'handleAirdropRewardBatch':
            //     console.log('manual task handleAirdropRewardBatch', utcYear, utcMonth, utcDay);
            //     await handleAirdropRewardBatch();
            //     return NextResponse.json({
            //         status: 'success',
            //         message: 'Airdrop reward batch processing completed'
            //     });

            default:
                return NextResponse.json({
                    status: 'error',
                    message: 'Invalid function'
                });
        }
    } catch (error) {
        console.error('Settlement error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error occurred' },
            { status: 500 }
        );
    }
}
