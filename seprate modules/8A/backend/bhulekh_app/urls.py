from django.urls import path
from . import views

urlpatterns = [
    path('locations/options', views.get_locations, name='get_locations'),
    path('locations/surveys', views.get_surveys, name='get_surveys'),
    path('workflows/start', views.start_workflow, name='start_workflow'),
    path('workflows/submit-captcha', views.submit_captcha, name='submit_captcha'),
    path('workflows/status/<str:run_id>', views.get_status, name='get_status'),
    path('workflows/view-pdf/<str:run_id>', views.view_pdf, name='view_pdf'),
    path('workflows/download-pdf/<str:run_id>', views.download_pdf, name='download_pdf'),
]
