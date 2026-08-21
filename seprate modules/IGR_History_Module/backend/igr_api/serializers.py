from rest_framework import serializers
from .models import Property, WorkflowRun, SourceRun


class PropertySerializer(serializers.ModelSerializer):
    class Meta:
        model = Property
        fields = [
            'id', 'label', 'district_name', 'taluka_name', 'village_name',
            'survey_number', 'subdivision_number', 'property_number',
            'district_code', 'taluka_code', 'village_code', 'created_at'
        ]


class SourceRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = SourceRun
        fields = [
            'id', 'workflow_run', 'source_name', 'source_year',
            'status', 'workflow_step', 'run_dir', 'input_payload',
            'metadata', 'error_message', 'created_at', 'completed_at'
        ]


class WorkflowRunSerializer(serializers.ModelSerializer):
    source_runs = SourceRunSerializer(many=True, read_only=True)

    class Meta:
        model = WorkflowRun
        fields = [
            'id', 'property', 'district_value', 'district_label',
            'taluka_value', 'taluka_label', 'village_value', 'village_label',
            'property_number', 'year_from', 'year_to', 'status',
            'current_step', 'total_steps', 'completed_steps', 'error_message',
            'result_json', 'source_runs', 'created_at', 'updated_at'
        ]
