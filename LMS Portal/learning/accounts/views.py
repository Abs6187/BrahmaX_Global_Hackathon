from django.shortcuts import render, redirect
from django.contrib.auth.models import User
from django.contrib import auth
from django.shortcuts import render, redirect
from django.contrib.auth.models import User
from django.contrib import auth
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.contrib.sites.shortcuts import get_current_site
from django.core.mail import EmailMessage
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode,urlsafe_base64_decode
from .tokens import account_activation_token
from .models import *
from .forms import *
from courses.models import *
import datetime
from django.contrib.auth.decorators import login_required
from courses.models import Enroll, Course

from quizzes.models import Result

from quizzes.models import SubmitAssignment

from quizzes.models import CreateQuiz_1

from django.views.decorators.csrf import ensure_csrf_cookie
from django.middleware.csrf import get_token

UserModel = get_user_model()

#Signin - forgot password + signin with google accounts/github/linkedin accounts.
@ensure_csrf_cookie
def login(request):
    if request.method == 'POST':
        # Ensure CSRF token is present
        if not request.POST.get('csrfmiddlewaretoken'):
            return render(request, 'login.html', {
                'message': 'CSRF token missing. Please refresh the page and try again.'
            })
            
        if request.POST.get('signin'):
            username = request.POST.get('username')
            password = request.POST.get('password')
            
            if not username or not password:
                return render(request, 'login.html', {
                    'message': 'Please enter both username and password'
                })
            
            # First check if the user exists
            try:
                user_exists = User.objects.filter(username=username).exists()
                if not user_exists:
                    return render(request, 'login.html', {
                        'message': f'No user found with username: {username}'
                    })
                
                # Get the user object
                user_obj = User.objects.get(username=username)
                if not user_obj.is_active:
                    return render(request, 'login.html', {
                        'message': 'This account is not active. Please contact administrator.'
                    })
                
                # Try to authenticate
                user = auth.authenticate(username=username, password=password)
                if user is None:
                    return render(request, 'login.html', {
                        'message': 'Incorrect password'
                    })

                auth.login(request, user)
                
                try:
                    det = Userdetail.objects.get(name=user)
                    if det.teacher:
                        courses = Course.objects.filter(author=user)
                        return render(request, 'dashboard.html', {'det': det, 'course': courses})
                    else:
                        cour = Enroll.objects.filter(student=user)
                        return render(request, 'studentdash.html', {'course': cour, 'det': det})
                except Userdetail.DoesNotExist:
                    # If user detail doesn't exist, create one with default values
                    det = Userdetail.objects.create(
                        name=user,
                        email=user.email,
                        fullname=f"{user.first_name} {user.last_name}",
                        bio="",
                        mob="",
                        teacher=False
                    )
                    return render(request, 'studentdash.html', {'course': [], 'det': det})
            except Exception as e:
                return render(request, 'login.html', {
                    'message': f'Error during login: {str(e)}'
                })
        elif request.POST.get('signup'):
            return render(request, 'register.html', {})
    else:
        # Generate CSRF token
        get_token(request)
        if request.user.is_authenticated:
            return redirect('accounts:dashboard')
        return render(request, 'login.html', {})

#Logout section
def logout(request):
    auth.logout(request)
    return render(request,'login.html',{})


#register a new user : signUp
def Register(request):
    if request.method == 'POST':
        UD = Userdetail()

        user_list = []
        for user in User.objects.values_list('username'):
            user_list.append(user[0])

         # if the username is already taken or not.
        if request.POST['username'] in user_list:
            return render(request,'register.html',{
                    'user_exist':'Username is already taken'
                    })

        #Check for password mismatch.
        if request.POST['pass'] == request.POST['cpass']:
            if len(request.POST['pass'])<6:
                return render(request,'register.html',{
                    'message_password':'password too short'
                    })
        else:
            return render(request,'register.html',{
                'message_password':'password mismatch'
                })

        NewUser = User.objects.create_user(username=request.POST['username'],email=request.POST['mail'],
            first_name=request.POST['first_name'],last_name=request.POST['last_name'])
        NewUser.set_password(request.POST['pass'])
        NewUser.is_active = True  # Set user as active by default
        NewUser.save()

        UD.name = NewUser
        UD.fullname = request.POST['first_name']+" "+request.POST['last_name']
        UD.bio = request.POST['bio']
        UD.email = request.POST['mail']
        UD.mob = request.POST['mob']

        if request.POST['type'] == 'teacher':
            UD.teacher = True
        else:
            UD.teacher = False

        UD.save()
        return render(request,'thanks.html',{
            'message':'Registration successful! You can now login with your credentials.',
            'user':request.POST['first_name']
            })
    else:
        return render(request,'register.html',{
            })

#for activating the inactive account.
def activate(request,uidb64,token):
    try:
        uid = urlsafe_base64_decode(uidb64).decode()
        user = UserModel._default_manager.get(pk=uid)
    except(TypeError,ValueError,OverflowError,User.DoesNotExist):
        user = None

    if user is not None and default_token_generator.check_token(user,token):
        user.is_active = True
        user.save()
        return render(request,'thanks.html',{
            'message':'Your Email has been Verified!!.You may now go ahead and login.',
            'user':user.first_name
            })
    else:
        return render(request,'error.html',{
            'error_message':'Activation Link Is Invalid!!'
            })

@login_required
def coursedetail(request,course_id):
    cour = Course.objects.filter(pk=course_id).first()
    stu = Enroll.objects.filter(course=cour)
    assign = SubmitAssignment.objects.filter(course=cour)
    return render(request, 'coursedetail.html', {'course': cour, 'student': stu, 'assign': assign})

@login_required
def contactsave(request):
    if request.method == 'POST':
        stu = User.objects.filter(pk=request.POST['student']).first()
        cc = Contact()
        cc.stu = stu
        cc.teacher = request.user
        cc.date = datetime.datetime.now().date()
        cc.subject = request.POST['sub']
        cc.message = request.POST['desc']
        cc.save()
        det = Userdetail.objects.filter(name=request.user).first()
        courses = Course.objects.filter(author=request.user)
        return render(request, 'dashboard.html', {'det': det, 'course': courses})

@login_required
def contact(request,stu_id):
    student = User.objects.filter(pk=stu_id).first()
    return render(request, 'contactstu.html',{'student': student})

@login_required
def stcontact(request):
    allPost = Contact.objects.filter(stu=request.user)
    return render(request, 'stcontact.html', {'allPost': allPost})

@login_required
def dashstu(request):
    cour = Enroll.objects.filter(student=request.user)
    det = Userdetail.objects.filter(name=request.user).first()
    return render(request, 'studentdash.html',{'course': cour, 'det':det})

@login_required
def dashteach(request):
    det = Userdetail.objects.filter(name=request.user).first()
    courses = Course.objects.filter(author=request.user)
    return render(request, 'dashboard.html', {'det': det, 'course': courses})

@login_required
def quizteach(request):
    quiz =Result.objects.filter(teach=request.user)
    return render(request, 'quizteach.html', {'quiz': quiz})

@login_required
def quizstu(request):
    quiz= Result.objects.filter(student=request.user)
    return render(request, 'quizstu.html', {'quiz': quiz})


@login_required
def dashboard(request):
    ud = Userdetail.objects.filter(name=request.user).first()
    if not ud:
        # Create default user details if not exists
        ud = Userdetail.objects.create(
            name=request.user,
            email=request.user.email,
            fullname=f"{request.user.first_name} {request.user.last_name}",
            bio="",
            mob="",
            teacher=False,
            city="",
            count=0,
            plan=""
        )
    if ud.teacher:
        return redirect('accounts:dashteach')
    else:
        return redirect('accounts:dashstu')

@login_required
def addquestion(request):
    quiz = CreateQuiz_1.objects.filter(author=request.user)
    return render(request, 'addquestion.html', {'quiz': quiz})