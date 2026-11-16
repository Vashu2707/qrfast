import { Suspense } from "react";
import HotelLoginPage from "./login-page";

export default function Page() {
  return (
    <Suspense fallback={<div className="text-center text-muted-foreground">Loading...</div>}>
      <HotelLoginPage />
    </Suspense>
  );
}
