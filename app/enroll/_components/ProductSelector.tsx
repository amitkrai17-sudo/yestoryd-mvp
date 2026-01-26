'use client';

import { Check, Info, Zap } from 'lucide-react';

interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  original_price: number;
  discounted_price: number;
  price_display: string;
  savings_display: string | null;
  sessions_included: number;
  duration_months: number;
  is_featured: boolean;
  available: boolean;
  eligibility_message: string | null;
}

interface ProductSelectorProps {
  products: Product[];
  selectedProductSlug: string;
  onSelect: (slug: string) => void;
  starterCompleted?: boolean;
  childId?: string;
}

export function ProductSelector({
  products,
  selectedProductSlug,
  onSelect,
  starterCompleted = false,
  childId,
}: ProductSelectorProps) {
  if (products.length <= 1) return null;

  return (
    <section className="mb-6 sm:mb-8 w-full max-w-md mx-auto lg:max-w-none">
      <h1 className="text-lg sm:text-xl font-semibold text-white mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-[#FF0099]" />
        Select Your Program
      </h1>
      <div className="space-y-3">
        {products.map((product) => {
          const isSelected = selectedProductSlug === product.slug;
          const isAvailable = product.available;

          return (
            <button
              key={product.id}
              onClick={() => isAvailable && onSelect(product.slug)}
              disabled={!isAvailable}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-[#FF0099] bg-[#FF0099]/10 shadow-sm'
                  : isAvailable
                  ? 'border-border hover:border-[#FF0099]/50 bg-surface-1'
                  : 'border-border/50 bg-surface-0 cursor-not-allowed opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'border-[#FF0099] bg-[#FF0099]' : 'border-border'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-semibold text-sm sm:text-base leading-tight ${isSelected ? 'text-[#FF0099]' : 'text-white'}`}>
                      {product.name}
                      {product.is_featured && (
                        <span className="ml-2 px-2 py-0.5 bg-[#FF0099]/10 text-[#FF0099] text-[10px] rounded-full font-bold">
                          BEST VALUE
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-text-tertiary mt-0.5">
                      {product.sessions_included} sessions • {product.duration_months} month{product.duration_months > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`font-bold text-base sm:text-lg ${isSelected ? 'text-[#FF0099]' : 'text-white'}`}>
                    {product.price_display}
                  </p>
                  {product.savings_display && (
                    <p className="text-xs text-green-600 font-medium">{product.savings_display}</p>
                  )}
                </div>
              </div>
              {!isAvailable && product.eligibility_message && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <Info className="w-3 h-3 flex-shrink-0" />
                  {product.eligibility_message}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {/* Continuation eligibility message */}
      {selectedProductSlug === 'continuation' && !starterCompleted && childId && (
        <div className="mt-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-semibold text-sm">Starter Pack Required</p>
            <p className="text-amber-400 text-xs">Complete the Starter Pack first to enroll in the Continuation program.</p>
          </div>
        </div>
      )}
    </section>
  );
}
