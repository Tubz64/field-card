# Guardrails for every account in the workloads OU. The management account is
# never affected by SCPs.
data "aws_iam_policy_document" "guardrails" {
  statement {
    sid       = "DenyLeavingOrganization"
    effect    = "Deny"
    actions   = ["organizations:LeaveOrganization"]
    resources = ["*"]
  }

  # Based on AWS's example region-deny SCP: global services are exempt because
  # their API calls are served from us-east-1 whatever region you pick.
  statement {
    sid    = "DenyOtherRegions"
    effect = "Deny"
    not_actions = [
      "a4b:*", "access-analyzer:*", "account:*", "acm:*", "aws-marketplace-management:*",
      "aws-marketplace:*", "aws-portal:*", "billing:*", "budgets:*", "ce:*", "chime:*",
      "cloudfront:*", "compute-optimizer:*", "config:*", "cost-optimization-hub:*", "cur:*",
      "directconnect:*", "ec2:DescribeRegions", "ec2:DescribeTransitGateways",
      "ec2:DescribeVpnGateways", "fms:*", "freetier:*", "globalaccelerator:*", "health:*",
      "iam:*", "identitystore:*", "importexport:*", "invoicing:*", "kms:*", "networkmanager:*",
      "organizations:*", "payments:*", "pricing:*", "route53:*", "route53domains:*",
      "route53-recovery-cluster:*", "route53-recovery-control-config:*",
      "route53-recovery-readiness:*", "s3:GetAccountPublic*", "s3:ListAllMyBuckets",
      "s3:ListMultiRegionAccessPoints", "s3:PutAccountPublic*", "shield:*", "sso:*",
      "sts:*", "support:*", "tax:*", "trustedadvisor:*", "waf-regional:*", "waf:*",
      "wafv2:*", "wellarchitected:*",
    ]
    resources = ["*"]

    condition {
      test     = "StringNotEquals"
      variable = "aws:RequestedRegion"
      values   = var.allowed_regions
    }
  }
}

resource "aws_organizations_policy" "guardrails" {
  name        = "${var.project}-guardrails"
  description = "Workload accounts: can't leave the organisation, and can only use the allowed regions."
  type        = "SERVICE_CONTROL_POLICY"
  content     = data.aws_iam_policy_document.guardrails.json
}

resource "aws_organizations_policy_attachment" "guardrails" {
  policy_id = aws_organizations_policy.guardrails.id
  target_id = aws_organizations_organizational_unit.workloads.id
}
