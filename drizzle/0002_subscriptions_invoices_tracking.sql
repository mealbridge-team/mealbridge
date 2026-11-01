CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sponsor_invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"sponsor_id" text NOT NULL,
	"pool_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"memo" text NOT NULL,
	"paypal_invoice_id" text NOT NULL,
	"invoice_number" text NOT NULL,
	"payer_view_url" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sponsor_invoices_paypal_invoice_id_unique" UNIQUE("paypal_invoice_id")
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "last_lat" double precision;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "last_lng" double precision;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "last_position_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "position_simulated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sponsor_invoices" ADD CONSTRAINT "sponsor_invoices_sponsor_id_sponsors_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."sponsors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sponsor_invoices" ADD CONSTRAINT "sponsor_invoices_pool_id_funding_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."funding_pools"("id") ON DELETE no action ON UPDATE no action;