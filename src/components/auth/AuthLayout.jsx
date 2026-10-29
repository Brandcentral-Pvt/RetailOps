import AuthFooter from './AuthFooter';
import AuthVisual from './AuthVisual';

export default function AuthLayout({ children }) {
  return (
    <main className="min-h-screen w-full bg-white text-slate-900">
      <div className="flex min-h-screen w-full flex-col lg:grid lg:grid-cols-[38fr_62fr]">
        <div className="flex min-h-screen w-full flex-col justify-center px-[20px] py-[40px] sm:px-[32px] lg:px-[40px] xl:px-[64px]">
          <div className="mx-auto w-full max-w-[420px]">
            <div className="mb-9">
              <img
                src="/brandcentral-logo.png"
                alt="BrandCentral"
                width="875"
                height="166"
                className="h-9 w-auto object-contain sm:h-10"
                fetchPriority="high"
              />
            </div>

            <section aria-label="RetailOps authentication" className="w-full">
              {children}
            </section>

            <AuthFooter />
          </div>
        </div>

        <AuthVisual />
      </div>
    </main>
  );
}
