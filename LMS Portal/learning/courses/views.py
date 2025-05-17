from django.shortcuts import render,  get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
# Create your views here.
from .models import *
from django.db.models import Q
from django.contrib.auth.models import User
import datetime
from django.contrib import messages

from quizzes.models import *

from quizzes.models import CreateAssignment

from quizzes.models import SubmitAssignment

@login_required
def allcourse(request):
    query = request.GET.get('q', None)
    if query:
        results = Course.objects.filter(Q(name__icontains=query) | Q(subject__icontains=query))
        return render(request, 'allcourse.html', {'course': results})
    else:
        cour = Course.objects.all()
        return render(request, 'allcourse.html', {'course': cour})

@login_required
def addcourse(request):
    if request.method == 'POST':
        cc = Course()
        cc.name = request.POST['name']
        cc.author = request.user
        cc.desc = request.POST['desc']
        cc.subject = request.POST['subject']
        cc.date = datetime.datetime.now().date()
        cc.img = request.FILES['image']
        cc.save()
    cour = Course.objects.filter(author=request.user)
    return render(request,'addcourse.html',{'course':cour})


@login_required
def addmaterial(request):
    mat = Material()
    nam = request.POST['course']
    cour = get_object_or_404(Course, author=request.user, name=nam)
    mat.course = cour
    mat.type = "Material"
    mat.file = request.FILES['material']
    mat.desc = request.POST['desc']
    mat.date = datetime.datetime.now().date()
    mat.save()
    cour = Course.objects.filter(author=request.user)
    return render(request, 'addcourse.html', {'course': cour})


@login_required
def detail(request, course_id):
    try:
        course = Course.objects.get(pk=course_id)
        taken = Enroll.objects.filter(student=request.user, course=course).exists()
        
        return render(request, 'detail.html', {
            'course': course,
            'taken': taken,
            'message': messages.get_messages(request)  # Pass any messages from enrollment
        })
    except Course.DoesNotExist:
        messages.error(request, 'Course not found.')
        return redirect('courses:allcourse')


@login_required
def enrollment(request, course_id):
    try:
        course = Course.objects.get(pk=course_id)
        
        # Only allow POST requests for enrollment
        if request.method != 'POST':
            return redirect('courses:detail', course_id=course_id)
            
        # Check if already enrolled
        if Enroll.objects.filter(student=request.user, course=course).exists():
            messages.warning(request, 'You are already enrolled in this course.')
            return redirect('courses:courmat', course_id=course_id)
        
        # Create new enrollment
        Enroll.objects.create(
            course=course,
            student=request.user,
            date=datetime.datetime.now(),
            done=False
        )
        
        # Update course count
        if course.count is None:
            course.count = 1
        else:
            course.count += 1
        course.save()
        
        messages.success(request, f'Successfully enrolled in {course.name}!')
        return redirect('courses:courmat', course_id=course_id)
        
    except Course.DoesNotExist:
        messages.error(request, 'Course not found.')
        return redirect('courses:allcourse')
    except Exception as e:
        messages.error(request, f'Error enrolling in course: {str(e)}')
        return redirect('courses:detail', course_id=course_id)

@login_required
def courmat(request, course_id):
    try:
        # Get the course
        cour = Course.objects.get(pk=course_id)
        
        # Check if student is enrolled
        if not Enroll.objects.filter(student=request.user, course=cour).exists():
            return render(request, 'error.html', {
                'message': 'You must be enrolled in this course to view materials'
            })
        
        # Get course materials
        material = Material.objects.filter(course=cour)
        
        # Get assignments
        assign = CreateAssignment.objects.filter(info=cour).order_by('-created_on')
        
        # Get quizzes
        test = CreateQuiz_1.objects.filter(info=cour)
        
        # Get submitted assignments
        submitted_assignments = SubmitAssignment.objects.filter(
            course=cour,
            student=request.user
        ).values_list('data_id', flat=True)
        
        return render(request, 'courmat.html', {
            'course': cour,
            'material': material,
            'tests': test,
            'assign': assign,
            'submitted_assignments': submitted_assignments
        })
        
    except Course.DoesNotExist:
        return render(request, 'error.html', {
            'message': 'Course not found'
        })

@login_required
def show(request, file_id):
    file = Material.objects.filter(pk=file_id).first()
    return render(request, 'show.html', {'mat': file})
@login_required
def assignment(request,assign_id):
    assign = CreateAssignment.objects.filter(pk=assign_id).first()
    return render(request, 'assignment.html', {'assign': assign})
@login_required
def submit(request, assign_id):
    try:
        # Get the assignment
        assign = get_object_or_404(CreateAssignment, pk=assign_id)
        
        if request.method == 'POST':
            # Create submission
            sub = SubmitAssignment.objects.create(
                studentResponse=request.FILES['work'],
                data=assign,
                course=assign.info,
                student=request.user,
                submitted_date=datetime.datetime.now()
            )
            
            # Redirect to course materials with success message
            return render(request, 'courmat.html', {
                'course': assign.info,
                'material': Material.objects.filter(course=assign.info),
                'tests': CreateQuiz_1.objects.filter(info=assign.info),
                'assign': CreateAssignment.objects.filter(info=assign.info).order_by('-created_on'),
                'submitted_assignments': SubmitAssignment.objects.filter(
                    course=assign.info,
                    student=request.user
                ).values_list('data_id', flat=True),
                'message': 'Assignment submitted successfully!'
            })
        else:
            # Show assignment details
            return render(request, 'assignment.html', {
                'assign': assign,
                'is_submitted': SubmitAssignment.objects.filter(
                    data=assign,
                    student=request.user
                ).exists()
            })
            
    except CreateAssignment.DoesNotExist:
        return render(request, 'error.html', {
            'message': 'Assignment not found'
        })
    except Exception as e:
        return render(request, 'error.html', {
            'message': f'Error submitting assignment: {str(e)}'
        })
