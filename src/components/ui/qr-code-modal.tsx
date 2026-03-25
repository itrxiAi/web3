import { useState, useRef, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import Image from "next/image";
import gridIcon from "@/public/images/grid-icon.svg";
import Logo from "./logo";
import { randomReferralCode } from "@/utils/auth";
import { useTranslations } from "next-intl";
import { useAppKitAccount } from "@reown/appkit/react";
import { UserType } from "@prisma/client";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  publicKey?: string | null;
  userType?: string | null;
}

/**
 * QR Code Modal component for sharing referral links.
 *
 * This component displays a modal with a QR code containing the user's referral link.
 * The modal includes options to download the QR code as an image or copy the referral link to the clipboard.
 *
 * @param {Object} props - Component props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {Function} props.onClose - Function to close the modal
 * @param {string|null} props.publicKey - The user's public key
 * @param {string|null} props.userType - The user's type
 * @returns {JSX.Element|null} The QR code modal component
 */
export function QRCodeModal({
  isOpen,
  onClose,
  publicKey,
  userType,
}: QRCodeModalProps) {
  const qrModalRef = useRef<HTMLDivElement>(null);
  const qrCardRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("qr_code");
  const [qrSize, setQrSize] = useState(200);
  const [showScreenshotTip, setShowScreenshotTip] = useState(false);

  // 检测是否在移动端WebView环境中
  const isInWebView = () => {
    const ua = navigator.userAgent.toLowerCase();

    // 常见的WebView标识
    const webviewSignatures = [
      "tokenpocket",
      "bitget",
      "bitkeep",
      "imtoken",
      "metamask-mobile",
      "trust",
      "walletconnect",
      "rainbow",
      "coinbase",
      "okx",
    ];

    // 检查是否是移动设备
    const isMobile = /android|iphone|ipad|ipod|windows phone/i.test(ua);

    // 检查是否包含常见的WebView标识
    const hasWebViewSignature = webviewSignatures.some((signature) =>
      ua.includes(signature.toLowerCase())
    );

    // 检查是否缺少常见的独立浏览器标识
    const isNotStandaloneBrowser = !(
      (
        (/chrome/.test(ua) && !/version|crios/.test(ua)) || // 排除Chrome
        (/firefox/.test(ua) && !/fxios/.test(ua)) || // 排除Firefox
        (/safari/.test(ua) && !/chrome|crios/.test(ua))
      ) // 排除Safari
    );

    // 检查是否存在WebView特有的属性
    const hasWebViewFeatures = !!(
      (
        (window as any).ReactNativeWebView ||
        (window as any).webkit?.messageHandlers ||
        (window as any).AlipayJSBridge
      )
    );

    return (
      isMobile &&
      (hasWebViewSignature || (isNotStandaloneBrowser && hasWebViewFeatures))
    );
  };

  // Set QR code size based on screen width
  useEffect(() => {
    // Only bind resize listener when modal is actually open.
    // This avoids unnecessary work during normal page navigation.
    if (!isOpen) return;

    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 360) {
        setQrSize(120);
      } else if (width < 480) {
        setQrSize(140);
      } else {
        setQrSize(160);
      }
    };

    handleResize(); // Set initial size
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen]);

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        qrModalRef.current &&
        !qrModalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isOpen, onClose]);

  // Generate referral URL and code
  const getReferralUrl = () => {
    const referralCode = randomReferralCode(publicKey || "");
    const url = `${window.location.origin}?ref=${referralCode}`;
    return url;
  };

  // Download QR card as image
  const downloadQRCard = async () => {
    if (!qrCardRef.current) {
      alert("Could not find QR card element to download");
      return;
    }

    try {
      // Lazily load html2canvas to reduce initial JS cost on route transitions.
      const { default: html2canvas } = await import("html2canvas");

      // 使用更准确的WebView检测
      if (isInWebView()) {
        setShowScreenshotTip(true);
        return;
      }

      // 保存原始样式
      const originalStyle = qrCardRef.current.style.cssText;

      // 找到标题元素并保存其原始样式
      const titleElement = qrCardRef.current.querySelector("h2");
      let originalTitleStyle = "";

      if (titleElement) {
        originalTitleStyle = titleElement.style.cssText;
        // 临时修改标题样式为纯色，以确保在图片中正确显示
        titleElement.style.background = "none";
        titleElement.style.webkitBackgroundClip = "unset";
        titleElement.style.webkitTextFillColor = "unset";
        titleElement.style.backgroundClip = "unset";
        titleElement.style.color = "#FFFFFF";
        titleElement.style.textShadow = "0 0 2px rgba(168, 153, 243, 0.5)";
      }

      // 设置临时样式以确保渐变和阴影效果被正确捕获
      qrCardRef.current.style.transform = "none";
      qrCardRef.current.style.boxShadow = "0 0 20px rgba(109, 75, 255, 0.5)";

      // 确保所有图片完全加载
      const images = Array.from(qrCardRef.current.querySelectorAll("img"));
      const svgImages = Array.from(qrCardRef.current.querySelectorAll("svg"));

      // 特别处理 Logo
      const logoImg = qrCardRef.current.querySelector(
        'img[alt="Logo"]'
      ) as HTMLImageElement;
      let originalLogoSrc = "";
      if (logoImg) {
        // 临时替换为内联的 base64 图片
        originalLogoSrc = logoImg.src;
        const canvas = document.createElement("canvas");
        canvas.width = logoImg.width;
        canvas.height = logoImg.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(logoImg, 0, 0);
          try {
            logoImg.src = canvas.toDataURL();
          } catch (e) {
            console.warn("Failed to convert logo to data URL", e);
          }
        }
      }

      await Promise.all([
        ...images.map(
          (img) =>
            new Promise((resolve) => {
              if (img.complete) {
                resolve(null);
              } else {
                img.onload = () => resolve(null);
                img.onerror = () => resolve(null);
              }
            })
        ),
        ...svgImages.map(
          (svg) =>
            new Promise((resolve) => {
              // 确保 SVG 内容已加载
              if (svg instanceof SVGGraphicsElement && svg.getBBox()) {
                resolve(null);
              } else {
                setTimeout(resolve, 100); // 给 SVG 一点时间加载
              }
            })
        ),
      ]);

      // 使用优化的配置进行渲染
      const canvas = await html2canvas(qrCardRef.current, {
        logging: true,
        allowTaint: true,
        background: "#1A1B35",
        useCORS: true,
        // @ts-expect-error onclone is a valid option but type definition is missing
        onclone: (clonedDoc: Document) => {
          const clonedElement = clonedDoc.querySelector(
            "[data-qr-card]"
          ) as HTMLElement;
          if (clonedElement) {
            // 确保克隆的元素保持原始样式
            clonedElement.style.transform = "none";
            // 确保 Logo 可见
            const logoImg = clonedElement.querySelector('img[alt="Logo"]');
            if (logoImg) {
              (logoImg as HTMLImageElement).style.opacity = "1";
              (logoImg as HTMLImageElement).style.visibility = "visible";
              // 强制重新加载图片
              (logoImg as HTMLImageElement).src = (
                logoImg as HTMLImageElement
              ).src;
            }
          }
        },
      });

      // 恢复原始样式
      qrCardRef.current.style.cssText = originalStyle;

      // 恢复标题原始样式
      if (titleElement) {
        titleElement.style.cssText = originalTitleStyle;
      }

      // 恢复 Logo 原始源
      if (logoImg && originalLogoSrc) {
        logoImg.src = originalLogoSrc;
      }

      // Convert canvas to data URL
      const dataUrl = canvas.toDataURL("image/png");

      // Create download link
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "referral-card.png";
      document.body.appendChild(link);
      link.click();

      // Clean up
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
    } catch (error) {
      console.error("Error capturing QR card:", error);
      alert(
        "Could not download the QR card. Please try again or take a screenshot."
      );
    }
  };

  if (!isOpen || !publicKey) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
          setShowScreenshotTip(false);
        }
      }}
    >
      {/* Outer border with orange glow */}
      <div
        ref={qrModalRef}
        className="rounded-[35px] border-2 border-blue-500 p-[8px] sm:p-[12px] md:p-[15px] w-full max-w-[90%] xs:max-w-[85%] sm:max-w-md md:max-w-lg mx-auto bg-clip-border my-auto"
        style={{
          maxHeight: "90vh",
          boxShadow: "0 0 30px rgba(0, 102, 204, 0.6)",
        }}
      >
        {/* Inner container with black background and starry effect */}
        <div
          className="bg-black p-2 xs:p-3 sm:p-4 md:p-5 rounded-[25px] w-full relative"
          // style={{
          //   background: `url("/images/v2/qrbg.png")`,
          //   backgroundSize: "100% 100%",
          //   backgroundRepeat: "no-repeat",
          // }}
        >
          {/* QR Card Content - This div will be captured for download */}
          <div
            ref={qrCardRef}
            className="rounded-[20.38px] bg-black p-2 sm:p-6 relative border-[1.47px] border-transparent overflow-hidden"
            style={{
              background: `
                radial-gradient(circle at 20% 30%, rgba(0, 102, 204, 0.1) 0%, transparent 50%),
                radial-gradient(circle at 80% 70%, rgba(0, 102, 204, 0.1) 0%, transparent 50%),
                url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='10' cy='10' r='0.5' fill='rgba(0, 102, 204, 0.3)'/%3E%3C/svg%3E"),
                #000000
              `,
              backgroundSize: "100% 100%, 100% 100%, 20px 20px, 100%",
              backgroundPosition: "center, center, center, center",
              backgroundRepeat: "no-repeat, no-repeat, repeat, no-repeat",
            }}
            data-qr-card
          >
            {/* Header with TwinX Logo */}
            <div className="flex justify-center items-center mb-4 sm:mb-6 relative z-10">
              <Image
                src="/images/v2/logo.png"
                alt="TwinX Logo"
                width={100}
                height={30}
              />
            </div>

            <div className="flex flex-col items-center relative z-10">
              <div
                className="bg-white p-2 rounded-lg mt-3 mb-3 sm:mb-5 qrcode-container flex items-center justify-center"
                style={{
                  width: `${qrSize + 20}px`,
                  height: `${qrSize + 20}px`,
                  margin: "0 auto",
                }}
              >
                <QRCodeSVG
                  value={getReferralUrl()}
                  size={qrSize}
                  level="H"
                  bgColor="#ffffff"
                  fgColor="#000000"
                  includeMargin={false}
                />
              </div>

              <div
                className="w-full  mt-4 px-0 "
                style={{
                  background:
                    "linear-gradient(86.19deg, rgba(0, 102, 204, 0.15) 0.78%, rgba(0, 102, 204, 0.15) 98.42%)",
                  border: "1px solid #0066CC",
                  borderRadius: "6px",
                }}
              >
                {/* Invite Code */}
                <div
                  className=" rounded-t-lg overflow-hidden "
                  style={{
                    borderBottom: "1px solid #0066CC",
                  }}
                >
                  <p className="text-center text-white text-sm font-medium py-1">
                    邀请码
                  </p>
                  <div
                    className=" text-white text-sm  text-center cursor-pointer pb-1"
                    style={{
                      letterSpacing: "0.3em",
                    }}
                    onClick={() => {
                      const code = randomReferralCode(publicKey || "");
                      if (navigator.clipboard) {
                        navigator.clipboard
                          .writeText(code)
                          .then(() => {
                            alert("Code copied to clipboard!");
                          })
                          .catch((err) => {
                            const textarea = document.createElement("textarea");
                            textarea.value = code;
                            document.body.appendChild(textarea);
                            textarea.select();
                            document.execCommand("copy");
                            document.body.removeChild(textarea);
                            alert("Code copied to clipboard!");
                          });
                      } else {
                        const textarea = document.createElement("textarea");
                        textarea.value = code;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand("copy");
                        document.body.removeChild(textarea);
                        alert("Code copied to clipboard!");
                      }
                    }}
                  >
                    {randomReferralCode(publicKey || "")}
                  </div>
                </div>

                {/* Invite Link */}
                <div className=" rounded-lg overflow-hidden px-1">
                  <p className="text-center text-white text-sm font-medium py-1">
                    邀请链接
                  </p>
                  <div
                    style={{
                      background: "rgba(141, 152, 234, 0.7)",
                    }}
                    className=" text-black text-xs  text-ellipsis text-center rounded-md mb-1"
                  >
                    {getReferralUrl()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Warning */}
          {userType !== UserType.COMMUNITY &&
            userType !== UserType.COMMUNITY &&
            userType !== UserType.COMMUNITY && (
              <div className="text-center text-sm text-[#FF3E3E] mb-1 mt-2">
                {t("warning")}
              </div>
            )}

          <div className="flex w-full gap-3 mt-2">
            <button
              className="flex-1 bg-blue-500 text-white text-sm py-3 px-4 rounded-lg font-medium hover:bg-blue-600 transition-colors"
              onClick={downloadQRCard}
            >
              保存图片
            </button>
            <button
              className="flex-1 bg-blue-500 text-white text-sm py-3 px-4 rounded-lg font-medium hover:bg-blue-600 transition-colors"
              onClick={() => {
                const url = getReferralUrl();

                try {
                  // Try modern clipboard API first
                  if (navigator.clipboard) {
                    navigator.clipboard
                      .writeText(url)
                      .then(() => {
                        alert("Link copied to clipboard!");
                      })
                      .catch((err) => {
                        // Fallback to the old method if modern API fails
                        const textarea = document.createElement("textarea");
                        textarea.value = url;
                        document.body.appendChild(textarea);
                        textarea.select();
                        document.execCommand("copy");
                        document.body.removeChild(textarea);
                        alert("Link copied to clipboard!");
                      });
                  } else {
                    // Fallback for browsers without clipboard API
                    const textarea = document.createElement("textarea");
                    textarea.value = url;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand("copy");
                    document.body.removeChild(textarea);
                    alert("Link copied to clipboard!");
                  }
                } catch (error) {
                  alert("Could not access clipboard. Please try again.");
                }
              }}
            >
              复制链接
            </button>
          </div>
        </div>

        {/* Screenshot Tip Modal */}
        {showScreenshotTip && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]"
            onClick={() => setShowScreenshotTip(false)}
          >
            <div className="bg-[#1A1A1A] p-6 rounded-2xl max-w-xs w-full mx-4 border border-blue-600/50">
              <h3 className="text-lg font-semibold text-white mb-4">
                {t("screenshot_tip_title")}
              </h3>
              <p className="text-gray-300 mb-6">
                {t("screenshot_tip_message")}
              </p>
              <button
                onClick={() => setShowScreenshotTip(false)}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                {t("got_it")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * QR Code Trigger component.
 *
 * This component displays a grid icon that, when clicked, can trigger a QR code modal.
 *
 * @param {Object} props - Component props
 * @param {Function} props.onClick - Function to call when the grid icon is clicked
 * @param {string} [props.className] - Additional CSS classes
 * @returns {JSX.Element} The QR code trigger component
 */
export function QRCodeTrigger({
  onClick,
  className = "",
}: {
  onClick: () => void;
  className?: string;
}) {
  const t = useTranslations("qr_code");

  return (
    <div className={`w-6 h-6 cursor-pointer relative ${className}`}>
      <Image
        src={gridIcon}
        alt={t("grid_icon_alt")}
        width={20}
        height={20}
        onClick={onClick}
      />
    </div>
  );
}

/**
 * QR Code Container component that manages state for the QR code modal.
 *
 * This is a convenience component that combines the QRCodeTrigger and QRCodeModal
 * with built-in state management.
 *
 * @param {Object} props - Component props
 * @param {string} [props.className] - Additional CSS classes for the trigger
 * @returns {JSX.Element} The QR code container component
 */
export default function QRCodeContainer({
  className = "",
}: {
  className?: string;
}) {
  const [showQRModal, setShowQRModal] = useState(false);
  const { address } = useAppKitAccount();

  const handleTriggerClick = () => {
    if (address) {
      setShowQRModal((prev) => !prev);
    }
  };

  return (
    <>
      <QRCodeTrigger onClick={handleTriggerClick} className={className} />
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        publicKey={address}
      />
    </>
  );
}
