// src/types/razorpay.d.ts
declare module "razorpay" {
  interface RazorpayOptions {
    key_id: string;
    key_secret: string;
  }
  interface RazorpayOrderOptions {
    amount: number;
    currency: string;
    receipt: string;
    notes?: Record<string, any>;
  }
  interface RazorpayOrder {
    id: string;
    amount: number;
    currency: string;
    receipt: string;
    status: string;
    created_at: number;
    notes?: Record<string, any>;
  }
  class Razorpay {
    constructor(options: RazorpayOptions);
    orders: {
      create(options: RazorpayOrderOptions): Promise<RazorpayOrder>;
    };
  }
  export = Razorpay;
}
