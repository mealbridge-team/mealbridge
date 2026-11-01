CREATE TABLE "donation_orders" (
	"order_id" text PRIMARY KEY NOT NULL,
	"pool_id" text NOT NULL,
	"donor_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"trip_id" text,
	"status" text DEFAULT 'created' NOT NULL,
	"capture_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donation_orders" ADD CONSTRAINT "donation_orders_pool_id_funding_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."funding_pools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_orders" ADD CONSTRAINT "donation_orders_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation_orders" ADD CONSTRAINT "donation_orders_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;