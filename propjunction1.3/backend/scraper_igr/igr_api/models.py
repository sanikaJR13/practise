from django.db import models


class Property(models.Model):
    label = models.CharField(max_length=255, blank=True, null=True)
    district_name = models.CharField(max_length=100)
    taluka_name = models.CharField(max_length=100)
    village_name = models.CharField(max_length=100)
    survey_number = models.CharField(max_length=100, default="", blank=True)
    subdivision_number = models.CharField(max_length=100, default="", blank=True)
    property_number = models.CharField(max_length=100, default="", blank=True)
    district_code = models.CharField(max_length=50, default="", blank=True)
    taluka_code = models.CharField(max_length=50, default="", blank=True)
    village_code = models.CharField(max_length=50, default="", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "properties"

    def __str__(self):
        return self.label or f"Property {self.id}"


class WorkflowRun(models.Model):
    id = models.CharField(max_length=100, primary_key=True)
    property = models.ForeignKey(Property, on_delete=models.CASCADE, related_name="workflow_runs")
    district_value = models.CharField(max_length=50)
    district_label = models.CharField(max_length=100)
    taluka_value = models.CharField(max_length=50)
    taluka_label = models.CharField(max_length=100)
    village_value = models.CharField(max_length=50)
    village_label = models.CharField(max_length=100)
    property_number = models.CharField(max_length=100)
    year_from = models.IntegerField()
    year_to = models.IntegerField()
    status = models.CharField(max_length=50, default="pending")  # pending, running, completed, failed, partial
    current_step = models.CharField(max_length=100, default="initial")
    total_steps = models.IntegerField(default=0)
    completed_steps = models.IntegerField(default=0)
    error_message = models.TextField(default="", blank=True)
    result_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Workflow {self.id} ({self.status})"


class SourceRun(models.Model):
    id = models.CharField(max_length=100, primary_key=True)
    workflow_run = models.ForeignKey(WorkflowRun, on_delete=models.CASCADE, related_name="source_runs")
    source_name = models.CharField(max_length=50, default="igr")
    source_year = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=50, default="pending")  # pending, running, completed, failed
    workflow_step = models.CharField(max_length=100, default="", blank=True)
    run_dir = models.CharField(max_length=255, default="", blank=True)
    input_payload = models.JSONField(default=dict, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(default="", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"SourceRun {self.id} - {self.source_name} ({self.status})"
