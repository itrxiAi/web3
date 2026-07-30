import { NextResponse } from 'next/server'
import { getCommunityMinLevel, getCommunityNum, getCommunityPriceDisplay, getDividendRewardNodeRatio, getReferralDirectRewardRateCommunity, getStakeCommunityDynamicRewardCap, getStakeCommunityDynamicRewardCapIncrement, getBatchTransferContract, getNodeDisperseRecipients, getVerifier1, getVerifier2 } from '@/lib/config'

const VERIFIER_MAX = 1000

export async function POST() {
  try {
    const appBackendUrl = process.env.APP_BACKEND_URL;
    let verifier1Count = 0;
    let verifier2Count = 0;

    if (appBackendUrl) {
      const statsResponse = await fetch(`${appBackendUrl}/internal/users/node-stats`);
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        const statsData = stats.data ?? stats;
        verifier1Count = statsData.verifier1Count ?? 0;
        verifier2Count = statsData.verifier2Count ?? 0;
      }
    }

    const communityMax = await getCommunityNum()
    const batchTransferContract = await getBatchTransferContract()
    const disperseRecipients = await getNodeDisperseRecipients()
    const v1Price = Number((await getVerifier1()).toString())
    const v2Price = Number((await getVerifier2()).toString())

    return NextResponse.json({
      communityNode: {
        price_display: await getCommunityPriceDisplay(),
        maxNum: communityMax,
        leftNum: communityMax - verifier1Count - verifier2Count,
        referralReward: await getReferralDirectRewardRateCommunity(),
        minLevel: await getCommunityMinLevel(),
        dynamicRewardCap: await getStakeCommunityDynamicRewardCap(),
        dynamicRewardCapIncrement: await getStakeCommunityDynamicRewardCapIncrement(),
        dividendReward: await getDividendRewardNodeRatio()
      },
      verifier1Node: {
        price_display: v1Price,
        maxNum: VERIFIER_MAX,
        leftNum: VERIFIER_MAX - verifier1Count,
        soldCount: verifier1Count,
        soldAmount: verifier1Count * v1Price,
      },
      verifier2Node: {
        price_display: v2Price,
        maxNum: VERIFIER_MAX,
        leftNum: VERIFIER_MAX - verifier2Count,
        soldCount: verifier2Count,
        soldAmount: verifier2Count * v2Price,
      },
      batchTransferContract,
      disperseRecipients,
    })
  } catch (error) {
    console.error('Error fetching node info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch node info' },
      { status: 500 }
    )
  }
}