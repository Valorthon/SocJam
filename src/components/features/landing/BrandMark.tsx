import Image from "next/image";

export function BrandMark() {
  return (
    <Image
      src="/branding/logo-light.svg"
      alt=""
      width={60}
      height={60}
      className="size-[60px]"
    />
  );
}
