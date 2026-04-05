TARGET_TINYGO = py32f030_64k_8k
TARGET_PYOCD = py32f030x8
CMSIS_PACK = PY32F030

IMAGE=image.elf

build:
	tinygo build --size full --serial uart --scheduler tasks --gc conservative --target ${TARGET_TINYGO} -o ${IMAGE} main.go

flash: build
	pyocd load -t ${TARGET_PYOCD} ${IMAGE}

gdb:
	pyocd gdb --target ${TARGET_PYOCD} --semihosting --persist

rtt:
	pyocd rtt -t ${TARGET_PYOCD}

install-pack:
	pyocd pack install ${CMSIS_PACK}

disassembly: build
	arm-none-eabi-objdump -dS ${IMAGE} > disassembly.txt
