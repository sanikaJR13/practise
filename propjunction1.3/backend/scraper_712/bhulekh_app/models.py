from django.db import models

class WorkflowRun(models.Model):
    run_id = models.CharField(max_length=64, unique=True, db_index=True)
    district = models.CharField(max_length=100)
    taluka = models.CharField(max_length=100)
    village = models.CharField(max_length=100)
    survey_number = models.CharField(max_length=100)
    survey_number_part1 = models.CharField(max_length=100, blank=True, null=True)
    mobile = models.CharField(max_length=20, blank=True, null=True)
    language = models.CharField(max_length=10, default="en_us")
    status = models.CharField(max_length=30, default="pending")
    error_message = models.TextField(blank=True, null=True)
    session_state_json = models.TextField(blank=True, null=True)
    result_json = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workflow_runs"
