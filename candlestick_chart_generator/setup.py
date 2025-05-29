from setuptools import setup, find_packages

def read_requirements():
    with open('requirements.txt') as req:
        content = req.read()
        requirements = content.split('\n')
    return [req for req in requirements if req.strip() and not req.startswith('#')]

setup(
    name='candlestick_chart_generator',
    version='0.1.0',
    packages=find_packages(include=['candlestick_chart_generator', 'candlestick_chart_generator.*']),
    include_package_data=True, # To include non-code files specified in MANIFEST.in (if any)
    install_requires=read_requirements(),
    author='AI Assistant',
    author_email='no-reply@example.com',
    description='A Python library to generate candlestick charts with volume and moving averages from Pandas DataFrames, providing an image object compatible with openpyxl.',
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    url='<your_repository_url_here>', # Optional: Replace with actual URL if available
    classifiers=[
        'Programming Language :: Python :: 3',
        'License :: OSI Approved :: MIT License', # Assuming MIT, adjust if different
        'Operating System :: OS Independent',
        'Development Status :: 3 - Alpha', # Or 4 - Beta, 5 - Production/Stable
        'Intended Audience :: Developers',
        'Intended Audience :: Financial and Insurance Industry',
        'Topic :: Office/Business :: Financial :: Investment',
        'Topic :: Scientific/Engineering :: Visualization',
    ],
    python_requires='>=3.7', # Specify minimum Python version
)
