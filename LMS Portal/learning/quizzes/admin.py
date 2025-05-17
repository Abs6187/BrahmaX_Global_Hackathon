from django.contrib import admin
from .models import *

class CreateAssignmentAdmin(admin.ModelAdmin):
    list_display = ('title', 'info', 'created_on')
    list_filter = ('info',)
    search_fields = ('title', 'desc')

class SubmitAssignmentAdmin(admin.ModelAdmin):
    list_display = ('data', 'student', 'course')
    list_filter = ('course', 'student')

admin.site.register(CreateAssignment, CreateAssignmentAdmin)
admin.site.register(CreateQuiz_1)
admin.site.register(CreateQuiz_2)
admin.site.register(SubmitAssignment, SubmitAssignmentAdmin)
admin.site.register(Exam)
admin.site.register(Result)