import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="iotivate.dev" width={28} height={28} />
              <p className="text-lg font-bold">
                iotivate<span className="text-accent">.dev</span>
              </p>
            </div>
            <p className="text-sm text-muted mt-2">
              Simplifying IoT, One Module at a Time.
            </p>
          </div>
          <div>
            <p className="font-semibold text-sm mb-3">Platform</p>
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <Link href="/tools" className="hover:text-foreground">
                  Tools
                </Link>
              </li>
              <li>
                <Link href="/projects" className="hover:text-foreground">
                  Projects
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-foreground">
                  Blog
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-sm mb-3">Company</p>
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <Link href="/about" className="hover:text-foreground">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border mt-8 pt-8 text-center text-sm text-muted">
          &copy; {new Date().getFullYear()} iotivate.dev. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
