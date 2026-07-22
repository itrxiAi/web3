import { NextResponse } from "next/server";
import {
  getEquityBasePriceDisplay,
  getEquityPlusPriceDisplay,
  getEquityPremiumPriceDisplay,
  getEquityExpertPriceDisplay,
  getEquityVipPriceDisplay,
} from "@/lib/config";
import {
  EQUITY_BASE_TYPE,
  EQUITY_PLUS_TYPE,
  EQUITY_PREMIUM_TYPE,
  EQUITY_EXPERT_TYPE,
  EQUITY_VIP_TYPE,
} from "@/constants";

export async function POST() {
  try {
    const [baseD, plusD, premD, expertD, vipD] = await Promise.all([
      getEquityBasePriceDisplay(),
      getEquityPlusPriceDisplay(),
      getEquityPremiumPriceDisplay(),
      getEquityExpertPriceDisplay(),
      getEquityVipPriceDisplay(),
    ]);

    return NextResponse.json({
      tiers: [
        {
          dev_type: EQUITY_BASE_TYPE,
          price_display: baseD.toString(),
        },
        {
          dev_type: EQUITY_PLUS_TYPE,
          price_display: plusD.toString(),
        },
        {
          dev_type: EQUITY_PREMIUM_TYPE,
          price_display: premD.toString(),
        },
        {
          dev_type: EQUITY_EXPERT_TYPE,
          price_display: expertD.toString(),
        },
        {
          dev_type: EQUITY_VIP_TYPE,
          price_display: vipD.toString(),
        },
      ],
    });
  } catch (error) {
    console.error("Error fetching equity info:", error);
    return NextResponse.json({ error: "Failed to fetch equity info" }, { status: 500 });
  }
}
