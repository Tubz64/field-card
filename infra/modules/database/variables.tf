variable "name_prefix" {
  description = "Table name, e.g. pawpers-dev."
  type        = string
}

variable "deletion_protection" {
  description = "Block deletion of the table."
  type        = bool
}
