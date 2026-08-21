from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'properties', views.PropertyViewSet, basename='property')
router.register(r'workflows', views.WorkflowRunViewSet, basename='workflow')
router.register(r'source-runs', views.SourceRunViewSet, basename='sourcerun')

urlpatterns = [
    # API endpoints under /api/v1/
    path('api/v1/locations/districts/', views.get_districts, name='get_districts'),
    path('api/v1/locations/talukas/', views.get_talukas, name='get_talukas'),
    path('api/v1/locations/villages/', views.get_villages, name='get_villages'),
    
    path('api/v1/properties/<int:property_id>/resolve_sources/', views.resolve_sources, name='resolve_sources'),
    path('api/v1/workflows/start_workflow/', views.start_workflow, name='start_workflow'),
    path('api/v1/workflows/<str:pk>/status/', views.WorkflowRunViewSet.as_view({'get': 'retrieve'}), name='workflow_status'),
    
    # Include Router viewsets
    path('api/v1/', include(router.urls)),
]
