import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { GROUP_TYPE, COMMUNITY_TYPE } from '@/constants'
import { getCommunityMinLevel, getCommunityNum, getCommunityPriceDisplay, getCommunityPriceTransfer, getDividendRewardNodeRatio, getGroupMinLevel, getGroupNum, getGroupPriceDisplay, getGroupPriceTransfer, getReferralDirectRewardRateCommunity, getReferralDirectRewardRateGroup, getStakeCommunityDynamicRewardCap, getStakeCommunityDynamicRewardCapIncrement, getStakeGroupDynamicRewardCap, getStakeGroupDynamicRewardCapIncrement } from '@/lib/config'

export async function POST() {
  try {
    // Count users by node type
    const [communityCount] = await Promise.all([
      // prisma.user.count({
      //   where: {
      //     type: GROUP_TYPE
      //   }
      // }),
      prisma.user.count({
        where: {
          type: COMMUNITY_TYPE
        }
      })
    ])
    const groupMax = await getGroupNum()
    const communityMax = await getCommunityNum()

    return NextResponse.json({
      // groupNode: {
      //   price_display: await getGroupPriceDisplay(),
      //   price_transfer: (await getGroupPriceTransfer()).toFixed(), // Convert to string to avoid scientific notation
      //   maxNum: groupMax,
      //   leftNum: groupMax - groupCount,
      //   referralReward: await getReferralDirectRewardRateGroup(),
      //   minLevel: await getGroupMinLevel(),
      //   // communityReward: await getStakeGroupNodeRewardRatio(),
      //   // incubationReward: await getStakeGroupNodeRewardDifRatio(),
      //   dynamicRewardCap: await getStakeGroupDynamicRewardCap(),
      //   dynamicRewardCapIncrement: await getStakeGroupDynamicRewardCapIncrement(),
      //   dividendReward: await getDividendRewardNodeRatio()
      // },
      communityNode: {
        price_display: await getCommunityPriceDisplay(),
        price_transfer: (await getCommunityPriceTransfer()).toFixed(), // Convert to string to avoid scientific notation
        maxNum: communityMax,
        leftNum: communityMax - communityCount,
        referralReward: await getReferralDirectRewardRateCommunity(),
        minLevel: await getCommunityMinLevel(),
        // communityReward: await getStakeCommunityNodeRewardRatio(),
        // incubationReward: await getStakeCommunityNodeRewardDifRatio(),
        dynamicRewardCap: await getStakeCommunityDynamicRewardCap(),
        dynamicRewardCapIncrement: await getStakeCommunityDynamicRewardCapIncrement(),
        dividendReward: await getDividendRewardNodeRatio()
      }
    })
  } catch (error) {
    console.error('Error fetching node info:', error)
    return NextResponse.json(
      { error: 'Failed to fetch node info' },
      { status: 500 }
    )
  }
}