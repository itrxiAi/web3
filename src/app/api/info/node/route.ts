import { NextResponse } from 'next/server'
import { getCommunityMinLevel, getCommunityNum, getCommunityPriceDisplay, getDividendRewardNodeRatio, getReferralDirectRewardRateCommunity, getStakeCommunityDynamicRewardCap, getStakeCommunityDynamicRewardCapIncrement, getBatchTransferContract, getNodeDisperseRecipients, getVerifier1, getVerifier2 } from '@/lib/config'

const VERIFIER_MAX = 1000

export async function POST() {
  try {
    const communityMax = await getCommunityNum()
    const batchTransferContract = await getBatchTransferContract()
    const disperseRecipients = await getNodeDisperseRecipients()
    const v1Price = Number((await getVerifier1()).toString())
    const v2Price = Number((await getVerifier2()).toString())

    // 写死 verifier 已售罄：soldCount=1000, leftNum=0
    const displayV1Count = VERIFIER_MAX;
    const displayV2Count = VERIFIER_MAX;

    return NextResponse.json({
      communityNode: {
        price_display: await getCommunityPriceDisplay(),
        maxNum: communityMax,
        leftNum: communityMax - VERIFIER_MAX - VERIFIER_MAX,
        referralReward: await getReferralDirectRewardRateCommunity(),
        minLevel: await getCommunityMinLevel(),
        dynamicRewardCap: await getStakeCommunityDynamicRewardCap(),
        dynamicRewardCapIncrement: await getStakeCommunityDynamicRewardCapIncrement(),
        dividendReward: await getDividendRewardNodeRatio()
      },
      verifier1Node: {
        price_display: v1Price,
        maxNum: VERIFIER_MAX,
        leftNum: 0,
        soldCount: displayV1Count,
        soldAmount: displayV1Count * v1Price,
      },
      verifier2Node: {
        price_display: v2Price,
        maxNum: VERIFIER_MAX,
        leftNum: 0,
        soldCount: displayV2Count,
        soldAmount: displayV2Count * v2Price,
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