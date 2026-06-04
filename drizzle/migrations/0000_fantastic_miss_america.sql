CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requisition_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"artifact_type" varchar(100) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"generated_content" text,
	"status" varchar(50) DEFAULT 'DRAFT' NOT NULL,
	"iteration_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requisitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"original_prompt" text NOT NULL,
	"status" varchar(50) DEFAULT 'AWAITING_SCOPE' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scope_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requisition_id" uuid NOT NULL,
	"content_md" text NOT NULL,
	"status" varchar(50) DEFAULT 'PENDING' NOT NULL,
	"user_feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"target_document" varchar(255) NOT NULL,
	"content_md" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_requisition_id_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."requisitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scope_proposals" ADD CONSTRAINT "scope_proposals_requisition_id_requisitions_id_fk" FOREIGN KEY ("requisition_id") REFERENCES "public"."requisitions"("id") ON DELETE cascade ON UPDATE no action;